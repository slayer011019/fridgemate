import * as menuDecisionsApi from '../../api/menuDecisionsApi';
import { MenuDecisionsApiError } from '../../api/menuDecisionsApi';
import * as indexedDb from '../../db/indexedDB';

function options(scope) {
  return { scope };
}

export function loadLocalMenuDecision(date, scope) {
  return indexedDb.getMenuDecision(date, options(scope));
}

export function saveLocalMenuDecision(decision, scope) {
  return indexedDb.saveMenuDecision(decision, options(scope));
}

export function removeLocalMenuDecision(date, scope) {
  return indexedDb.deleteMenuDecision(date, options(scope));
}

export function loadServerMenuDecision(date) {
  return menuDecisionsApi.getMenuDecision(date);
}

export function saveServerMenuDecision(date, decision) {
  if (decision.status === 'completed') return menuDecisionsApi.completeMenuDecision(date, decision);
  if (decision.status === 'cancelled') return menuDecisionsApi.cancelMenuDecision(date, decision);
  return menuDecisionsApi.selectMenuDecision(date, decision);
}

export function isRetryableMenuDecisionError(error) {
  return error instanceof MenuDecisionsApiError && (!error.status || error.status >= 500);
}
