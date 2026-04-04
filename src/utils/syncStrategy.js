export const SYNC_STRATEGY = 'updatedAt-preferred';

export const SYNC_STATE = {
  CLEAN: 'clean',
  PENDING_CREATE: 'pendingCreate',
  PENDING_UPDATE: 'pendingUpdate',
  PENDING_DELETE: 'pendingDelete',
  CONFLICT: 'conflict'
};

// Current synchronization strategy:
// - Guest mode stays fully local and does not reconcile with the server.
// - Authenticated mode treats the server as canonical, but compares cached
//   IndexedDB snapshots using updatedAt before replacing them blindly.
// - Local fallback writes may be marked as pending, so future sync work can
//   upgrade this flow without rewriting the storage layer.

function getComparableTimestamp(value) {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function normalizeSyncIngredient(ingredient, overrides = {}) {
  if (!ingredient) {
    return null;
  }

  return {
    ...ingredient,
    syncState: ingredient.syncState || SYNC_STATE.CLEAN,
    lastSyncedAt: ingredient.lastSyncedAt || ingredient.updatedAt || null,
    ...overrides
  };
}

export function markIngredientAsSynced(ingredient) {
  return normalizeSyncIngredient(ingredient, {
    syncState: SYNC_STATE.CLEAN,
    lastSyncedAt: ingredient?.updatedAt || new Date().toISOString()
  });
}

export function markIngredientAsPending(ingredient, syncState = SYNC_STATE.PENDING_UPDATE) {
  return normalizeSyncIngredient(ingredient, {
    syncState
  });
}

export function resolveIngredientConflict({ localIngredient = null, remoteIngredient = null } = {}) {
  if (!localIngredient && !remoteIngredient) {
    return null;
  }

  if (!localIngredient) {
    return markIngredientAsSynced(remoteIngredient);
  }

  if (!remoteIngredient) {
    return normalizeSyncIngredient(localIngredient);
  }

  const localUpdatedAt = getComparableTimestamp(localIngredient.updatedAt);
  const remoteUpdatedAt = getComparableTimestamp(remoteIngredient.updatedAt);
  const localIsPending =
    localIngredient.syncState === SYNC_STATE.PENDING_CREATE ||
    localIngredient.syncState === SYNC_STATE.PENDING_UPDATE ||
    localIngredient.syncState === SYNC_STATE.PENDING_DELETE;

  if (remoteUpdatedAt > localUpdatedAt) {
    if (localIsPending) {
      return normalizeSyncIngredient(remoteIngredient, {
        syncState: SYNC_STATE.CONFLICT,
        lastSyncedAt: remoteIngredient.updatedAt || new Date().toISOString()
      });
    }

    return markIngredientAsSynced(remoteIngredient);
  }

  if (localIsPending) {
    return normalizeSyncIngredient(localIngredient);
  }

  return markIngredientAsSynced(remoteIngredient);
}

export async function syncIngredientSnapshot({
  localIngredients = [],
  remoteIngredients = [],
  strategy = SYNC_STRATEGY
} = {}) {
  const localMap = new Map(localIngredients.map((ingredient) => [ingredient.id, ingredient]));
  const remoteMap = new Map(remoteIngredients.map((ingredient) => [ingredient.id, ingredient]));
  const ids = new Set([...localMap.keys(), ...remoteMap.keys()]);
  const nextSnapshot = [];
  const pendingUploads = [];
  const pendingDownloads = [];
  const conflicts = [];

  ids.forEach((id) => {
    const localIngredient = localMap.get(id) || null;
    const remoteIngredient = remoteMap.get(id) || null;
    const resolvedIngredient = resolveIngredientConflict({
      localIngredient,
      remoteIngredient
    });

    if (!resolvedIngredient) {
      return;
    }

    if (!localIngredient && remoteIngredient) {
      pendingDownloads.push(markIngredientAsSynced(remoteIngredient));
    }

    if (resolvedIngredient.syncState === SYNC_STATE.CONFLICT) {
      conflicts.push({
        id,
        localIngredient,
        remoteIngredient,
        resolvedIngredient
      });
    }

    if (
      resolvedIngredient.syncState === SYNC_STATE.PENDING_CREATE ||
      resolvedIngredient.syncState === SYNC_STATE.PENDING_UPDATE ||
      resolvedIngredient.syncState === SYNC_STATE.PENDING_DELETE
    ) {
      pendingUploads.push(resolvedIngredient);
    }

    nextSnapshot.push(resolvedIngredient);
  });

  nextSnapshot.sort((left, right) => {
    const leftTimestamp = getComparableTimestamp(left.updatedAt || left.createdAt);
    const rightTimestamp = getComparableTimestamp(right.updatedAt || right.createdAt);
    return rightTimestamp - leftTimestamp;
  });

  return {
    strategy,
    pendingUploads,
    pendingDownloads,
    conflicts,
    nextSnapshot
  };
}
