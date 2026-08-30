import { getRecipeKey, getRecipeName } from '../recipes/recipeIdentity';

export function getKoreanDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function createClientId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `decision-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function buildMenuDecision(recipe, current, date = new Date()) {
  const now = date.toISOString();
  return {
    clientId: current?.clientId || createClientId(),
    decisionDate: getKoreanDate(date),
    recipeKey: getRecipeKey(recipe),
    recipeName: getRecipeName(recipe),
    recommendationSource: recipe._recommendationSource || null,
    status: 'selected',
    selectedAt: now,
    completedAt: null,
    updatedAt: now,
    syncState: 'pending'
  };
}

export function updateMenuDecisionStatus(current, status, date = new Date()) {
  const now = date.toISOString();
  return {
    ...current,
    status,
    completedAt: status === 'completed' ? now : null,
    updatedAt: now,
    syncState: 'pending'
  };
}

export function mergeMenuDecision(localDecision, serverDecision) {
  if (!serverDecision) return localDecision || null;
  if (!localDecision) return { ...serverDecision, syncState: 'clean' };
  const serverIsNewer = Date.parse(serverDecision.updatedAt || 0) > Date.parse(localDecision.updatedAt || 0);
  if ((localDecision.syncState === 'pending' || localDecision.syncState === 'error') && !serverIsNewer) {
    return localDecision;
  }
  return serverIsNewer
    ? { ...serverDecision, syncState: 'clean' }
    : localDecision;
}
