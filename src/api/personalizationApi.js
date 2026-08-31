import { ApiClientError, requestJson } from './apiClient';

export class PersonalizationApiError extends ApiClientError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'PersonalizationApiError';
  }
}

const options = { authMode: 'required', errorClass: PersonalizationApiError };

export function getPantryOwnership() {
  return requestJson('/pantry-ownership', {}, options);
}

export function savePantryOwnership(items) {
  return requestJson('/pantry-ownership', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items })
  }, options);
}

export function getUserPreferences() {
  return requestJson('/user-preferences', {}, options);
}

export function saveUserPreferences(preferences) {
  return requestJson('/user-preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferences)
  }, options);
}
