import { ApiClientError, requestJson } from './apiClient';

export class IngredientsApiError extends ApiClientError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'IngredientsApiError';
  }
}

export function getAllIngredients() {
  return requestJson('/ingredients', {}, { errorClass: IngredientsApiError });
}

export function getIngredientById(id) {
  return requestJson(`/ingredients/${id}`, {}, { errorClass: IngredientsApiError });
}

export function saveIngredient(ingredient) {
  if (ingredient.id) {
    return requestJson(
      `/ingredients/${ingredient.id}`,
      {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(ingredient)
      },
      { errorClass: IngredientsApiError }
    );
  }

  return requestJson(
    '/ingredients',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(ingredient)
    },
    { errorClass: IngredientsApiError }
  );
}

export function saveIngredients(ingredients) {
  return requestJson(
    '/ingredients/sync',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ items: ingredients })
    },
    { errorClass: IngredientsApiError }
  );
}

export function deleteIngredient(id) {
  return requestJson(
    `/ingredients/${id}`,
    {
      method: 'DELETE'
    },
    {
      errorClass: IngredientsApiError,
      allowNoContent: true
    }
  );
}
