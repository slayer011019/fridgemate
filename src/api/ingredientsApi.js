import { apiBaseUrl } from '../utils/backendConfig';

export class IngredientsApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'IngredientsApiError';
    this.status = options.status;
    this.path = options.path;
    this.cause = options.cause;
  }
}

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });
  } catch (error) {
    throw new IngredientsApiError('API request could not reach the server.', {
      path,
      cause: error
    });
  }

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new IngredientsApiError(errorPayload.message || 'API request failed.', {
      status: response.status,
      path
    });
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function getAllIngredients() {
  return request('/ingredients');
}

export function getIngredientById(id) {
  return request(`/ingredients/${id}`);
}

export function saveIngredient(ingredient) {
  if (ingredient.id) {
    return request(`/ingredients/${ingredient.id}`, {
      method: 'PATCH',
      body: JSON.stringify(ingredient)
    });
  }

  return request('/ingredients', {
    method: 'POST',
    body: JSON.stringify(ingredient)
  });
}

export function saveIngredients(ingredients) {
  return request('/ingredients/bulk', {
    method: 'POST',
    body: JSON.stringify({ items: ingredients })
  });
}

export function deleteIngredient(id) {
  return request(`/ingredients/${id}`, {
    method: 'DELETE'
  });
}
