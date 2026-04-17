import { SYNC_STRATEGY } from '../../utils/syncStrategy';

const scopeStateCache = new Map();

export function createEmptySyncSummary() {
  return {
    strategy: SYNC_STRATEGY,
    pendingUploads: [],
    pendingDownloads: [],
    conflicts: [],
    nextSnapshot: []
  };
}

export function getScopeState(scope) {
  if (!scopeStateCache.has(scope)) {
    scopeStateCache.set(scope, {
      items: [],
      loaded: false,
      promise: null,
      syncSummary: createEmptySyncSummary()
    });
  }

  return scopeStateCache.get(scope);
}

export function buildScopeOptions(scope) {
  return { scope };
}
