import { ApiClientError, requestJson } from './apiClient';
import { isBackendEnabled } from '../utils/backendConfig';
import { getAnalyticsSessionId } from '../utils/analytics';

export class RecommendationEventsApiError extends ApiClientError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'RecommendationEventsApiError';
  }
}

let eventRequestQueue = Promise.resolve();

function enqueueEventRequest(request) {
  const queuedRequest = eventRequestQueue.then(request, request);
  eventRequestQueue = queuedRequest.catch(() => null);
  return queuedRequest;
}

function getRecipeId(recipe = {}) {
  const rawId = String(
    recipe.recipeId || recipe.id || recipe.sourceRecipeId || recipe.title || recipe.name || ''
  ).trim();

  if (!rawId || /^(?:catalog|local):/u.test(rawId)) return rawId;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(rawId)) {
    return `catalog:${rawId}`;
  }
  return `local:${rawId}`;
}

export function buildRecommendationEventPayload(recipe = {}, eventType, options = {}) {
  const missingIngredients = recipe.missingIngredients || recipe.missingCore || [];
  const urgentMatches = recipe.urgentMatches || recipe.expiringMatchedIngredients || [];

  return {
    eventType,
    recipeId: getRecipeId(recipe),
    sessionId: getAnalyticsSessionId(),
    rank: options.rank ?? recipe._recommendationRank ?? null,
    score: recipe.score ?? recipe.finalScore ?? null,
    matchRate: recipe.matchRate ?? null,
    missingIngredientCount: recipe.missingIngredientCount ?? recipe.missingCount ?? missingIngredients.length,
    urgentMatchCount: recipe.urgentMatchCount ?? urgentMatches.length,
    canMakeNow: typeof recipe.canMakeNow === 'boolean' ? recipe.canMakeNow : null,
    source: options.source || recipe._recommendationSource || null,
    metadata: {
      recipeName: recipe.title || recipe.name || null,
      group: options.group || null
    }
  };
}

export function saveRecommendationEvent(recipe, eventType, options = {}) {
  if (!isBackendEnabled()) {
    return Promise.resolve(null);
  }

  const payload = buildRecommendationEventPayload(recipe, eventType, options);

  if (!payload.recipeId) {
    return Promise.resolve(null);
  }

  return enqueueEventRequest(() =>
    requestJson(
      '/recommendation-events',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      },
      { authMode: 'auto', errorClass: RecommendationEventsApiError }
    )
  );
}
