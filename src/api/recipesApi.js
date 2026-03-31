import { apiBaseUrl } from '../utils/backendConfig';

export class RecipesApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'RecipesApiError';
    this.status = options.status;
    this.path = options.path;
    this.cause = options.cause;
  }
}

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, options);
  } catch (error) {
    throw new RecipesApiError('Recipe API request could not reach the server.', {
      path,
      cause: error
    });
  }

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new RecipesApiError(errorPayload.message || 'Recipe API request failed.', {
      status: response.status,
      path
    });
  }

  return response.json();
}

export function getRecipeRecommendations(pantryOwnership = {}) {
  return request('/recipes/recommendations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ pantryOwnership })
  });
}
