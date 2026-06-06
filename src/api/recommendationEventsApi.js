import { ApiClientError, requestJson } from './apiClient';
import { isBackendEnabled } from '../utils/backendConfig';
import { getAnalyticsSessionId } from '../utils/analytics';

export class RecommendationEventsApiError extends ApiClientError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'RecommendationEventsApiError';
  }
}

function getRecipeId(recipe = {}) {
  return String(recipe.recipeId || recipe.id || recipe.sourceRecipeId || recipe.title || recipe.name || '').trim();
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

  return requestJson(
    '/recommendation-events',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    },
    { authMode: 'auto', errorClass: RecommendationEventsApiError }
  );
}
