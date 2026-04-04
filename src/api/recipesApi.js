import { ApiClientError, requestJson } from './apiClient';

export class RecipesApiError extends ApiClientError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'RecipesApiError';
  }
}

export function getRecipeRecommendations(ingredients = [], pantryItems = []) {
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
        pantryItems: pantryItems.map((item) => String(item || '').trim()).filter(Boolean)
      })
    },
    { errorClass: RecipesApiError }
  );
}

export function aiSuggestRecipes(ingredients = []) {
  return requestJson(
    '/recipes/ai-suggest',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ingredients: ingredients.map((ingredient) => ({
          name: ingredient.name,
          expiresAt: ingredient.expiryDate || ingredient.expiresAt || null,
          quantity: ingredient.quantity ?? null,
          consumed: Boolean(ingredient.consumed)
        }))
      })
    },
    { errorClass: RecipesApiError }
  );
}
