import { apiBaseUrl } from '../utils/backendConfig';

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'API request failed.');
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
