import { Router } from 'express';
import {
  getAiRecipeSuggestionsHandler,
  getRecipeRecommendationsHandler,
  getSemanticRecipeRecommendationsHandler
} from '../controllers/recipeController.js';
import { createRateLimit, getClientAddress } from '../middleware/rateLimit.js';

export const recipeRoutes = Router();

export function getRecipeComputationRateLimitCost(request, defaultCost = 1) {
  const ingredients = Array.isArray(request.body?.availableIngredients)
    ? request.body.availableIngredients
    : request.body?.ingredients;
  const itemCount = Array.isArray(ingredients) ? ingredients.length : 0;
  return itemCount > 0
    ? Math.min(50, Math.ceil(itemCount / 10))
    : defaultCost;
}

export function getSemanticRecommendationRateLimitCost(request) {
  return getRecipeComputationRateLimitCost(request, 5);
}

const aiSuggestUserRateLimit = createRateLimit({
  scope: 'ai-suggest-user',
  limit: 20,
  windowMs: 60 * 60 * 1000,
  key: (request) => `user:${request.auth.userId}`,
  cost: getRecipeComputationRateLimitCost,
  message: 'Too many AI suggestion requests. Please try again later.'
});

const aiSuggestClientRateLimit = createRateLimit({
  scope: 'ai-suggest-client',
  limit: 60,
  windowMs: 60 * 60 * 1000,
  key: getClientAddress,
  cost: getRecipeComputationRateLimitCost,
  message: 'Too many AI suggestion requests. Please try again later.'
});

const semanticRecommendationUserRateLimit = createRateLimit({
  scope: 'semantic-recommendations-user',
  limit: 30,
  windowMs: 60 * 60 * 1000,
  key: (request) => `user:${request.auth.userId}`,
  cost: getSemanticRecommendationRateLimitCost,
  message: 'Too many semantic recommendation requests. Please try again later.'
});

const semanticRecommendationClientRateLimit = createRateLimit({
  scope: 'semantic-recommendations-client',
  limit: 60,
  windowMs: 60 * 60 * 1000,
  key: getClientAddress,
  cost: getSemanticRecommendationRateLimitCost,
  message: 'Too many semantic recommendation requests. Please try again later.'
});

const recommendationUserRateLimit = createRateLimit({
  scope: 'recipe-recommendations-user',
  limit: 120,
  windowMs: 60 * 60 * 1000,
  key: (request) => `user:${request.auth.userId}`,
  message: 'Too many recipe recommendation requests. Please try again later.'
});

const recommendationClientRateLimit = createRateLimit({
  scope: 'recipe-recommendations-client',
  limit: 240,
  windowMs: 60 * 60 * 1000,
  key: getClientAddress,
  message: 'Too many recipe recommendation requests. Please try again later.'
});

recipeRoutes.get(
  '/recommendations',
  recommendationUserRateLimit,
  recommendationClientRateLimit,
  getRecipeRecommendationsHandler
);
recipeRoutes.post(
  '/recommendations',
  recommendationUserRateLimit,
  recommendationClientRateLimit,
  getRecipeRecommendationsHandler
);
recipeRoutes.post(
  '/recommendations/semantic',
  semanticRecommendationUserRateLimit,
  semanticRecommendationClientRateLimit,
  getSemanticRecipeRecommendationsHandler
);
recipeRoutes.post(
  '/ai-suggest',
  aiSuggestUserRateLimit,
  aiSuggestClientRateLimit,
  getAiRecipeSuggestionsHandler
);
