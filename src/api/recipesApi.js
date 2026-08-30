import { ApiClientError, requestJson } from './apiClient';
import {
  createExternalAiRequestSignal,
  EXTERNAL_AI_ACTIONS
} from './externalAiRequest';
import { getRemainingDays } from '../utils/date';

export class RecipesApiError extends ApiClientError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'RecipesApiError';
  }
}

export function getRecipeRecommendations(ingredients = [], pantryItems = [], preferences = {}) {
  return requestJson(
    '/recipes/recommendations',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ingredients: ingredients.map((ingredient) => ({
          name: ingredient.name,
          expiresAt: ingredient.expiryDate || ingredient.expiresAt || null,
          consumed: Boolean(ingredient.consumed)
        })),
        pantryItems: pantryItems.map((item) => String(item || '').trim()).filter(Boolean),
        preferences
      })
    },
    { authMode: 'required', errorClass: RecipesApiError }
  );
}

export function getSemanticRecipeRecommendations(
  ingredients = [],
  pantryItems = [],
  preferences = {},
  options = {}
) {
  const externalAi = createExternalAiRequestSignal(EXTERNAL_AI_ACTIONS.semanticRecipes, options);

  if (!externalAi) {
    return Promise.resolve({ mode: 'rule-fallback', recommendations: [], meta: { externalAiUsed: false } });
  }

  const activeIngredients = ingredients.filter((ingredient) => !ingredient.consumed && !ingredient.deletedAt);

  return requestJson(
    '/recipes/recommendations/semantic',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        availableIngredients: activeIngredients.map((ingredient) => ingredient.name),
        expiringIngredients: activeIngredients
          .filter((ingredient) => {
            const remainingDays = getRemainingDays(ingredient.expiryDate || ingredient.expiresAt);
            return remainingDays !== null && remainingDays >= 0 && remainingDays <= 3;
          })
          .map((ingredient) => ingredient.name),
        pantryItems: pantryItems.map((item) => String(item || '').trim()).filter(Boolean),
        preferences,
        externalAi
      })
    },
    { authMode: 'required', errorClass: RecipesApiError }
  );
}

export function aiSuggestRecipes(ingredients = [], options = {}) {
  const externalAi = createExternalAiRequestSignal(EXTERNAL_AI_ACTIONS.aiRecipeSuggestions, options);

  return requestJson(
    '/recipes/ai-suggest',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ingredients: ingredients
          .filter((ingredient) => !ingredient.consumed && !ingredient.deletedAt)
          .map((ingredient) => ({
            name: ingredient.name,
            expiresSoon: (() => {
              const remainingDays = getRemainingDays(ingredient.expiryDate || ingredient.expiresAt);
              return remainingDays !== null && remainingDays >= 0 && remainingDays <= 3;
            })()
          })),
        externalAi
      })
    },
    { authMode: 'required', errorClass: RecipesApiError }
  );
}
