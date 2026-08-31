import { ApiClientError, requestJson } from './apiClient';

export class MenuDecisionsApiError extends ApiClientError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'MenuDecisionsApiError';
  }
}

const requestOptions = { authMode: 'required', errorClass: MenuDecisionsApiError };

export function getMenuDecision(date) {
  return requestJson(`/menu-decisions?date=${encodeURIComponent(date)}`, {}, requestOptions);
}

export function selectMenuDecision(date, decision) {
  return requestJson(
    `/menu-decisions/${encodeURIComponent(date)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: decision.clientId,
        recipeKey: decision.recipeKey,
        recipeName: decision.recipeName,
        recommendationSource: decision.recommendationSource || null,
        selectedAt: decision.selectedAt
      })
    },
    requestOptions
  );
}

export function completeMenuDecision(date, decision) {
  return requestJson(
    `/menu-decisions/${encodeURIComponent(date)}/complete`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: decision.clientId, completedAt: decision.completedAt })
    },
    requestOptions
  );
}

export function cancelMenuDecision(date, decision) {
  return requestJson(
    `/menu-decisions/${encodeURIComponent(date)}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: decision.clientId })
    },
    requestOptions
  );
}
