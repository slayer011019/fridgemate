import { ApiClientError, requestJson } from './apiClient';
import { isBackendEnabled } from '../utils/backendConfig';
import { getAnalyticsSessionId } from '../utils/analytics';
import { getAnalyticsConsent } from '../utils/analyticsConsent';
import { getRecipeKey } from '../features/recipes/recipeIdentity';
import { createSecureId } from '../utils/secureId';

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

function createClientEventId() {
  return createSecureId('event');
}

export function buildRecommendationEventPayload(recipe = {}, eventType, options = {}) {
  const missingIngredients = recipe.missingIngredients || recipe.missingCore || [];
  const urgentMatches = recipe.urgentMatches || recipe.expiringMatchedIngredients || [];

  return {
    eventType,
    recipeId: getRecipeKey(recipe),
    clientEventId: options.clientEventId || createClientEventId(),
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
      group: options.group || null,
      screen: options.screen || null
    }
  };
}

export function saveRecommendationEvent(recipe, eventType, options = {}) {
  if (!isBackendEnabled() || getAnalyticsConsent() !== 'granted') {
    return Promise.resolve(null);
  }

  const payload = buildRecommendationEventPayload(recipe, eventType, options);

  if (!payload.recipeId || !payload.clientEventId || !payload.sessionId) {
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
      { authMode: 'required', errorClass: RecommendationEventsApiError }
    )
  );
}
