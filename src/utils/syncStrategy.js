export const SYNC_STRATEGY = 'updatedAt-preferred';

export const SYNC_STATE = {
  CLEAN: 'clean',
  PENDING_CREATE: 'pendingCreate',
  PENDING_UPDATE: 'pendingUpdate',
  PENDING_DELETE: 'pendingDelete',
  CONFLICT: 'conflict'
};

function getComparableTimestamp(value) {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function getIngredientSyncKey(ingredient) {
  return ingredient?.clientId || ingredient?.id || '';
}

export function isPendingSyncState(syncState) {
  return [SYNC_STATE.PENDING_CREATE, SYNC_STATE.PENDING_UPDATE, SYNC_STATE.PENDING_DELETE].includes(syncState);
}

export function isIngredientDeleted(ingredient) {
  return Boolean(ingredient?.deletedAt);
}

export function compactIngredientTombstone(ingredient, overrides = {}) {
  const normalized = { ...ingredient, ...overrides };
  const id = normalized.id || normalized.clientId;
  const tombstone = {
    id,
    clientId: normalized.clientId || id,
    updatedAt: normalized.updatedAt || normalized.deletedAt,
    deletedAt: normalized.deletedAt,
    syncState: normalized.syncState || SYNC_STATE.CLEAN
  };

  if (Object.hasOwn(normalized, 'userId')) {
    tombstone.userId = normalized.userId;
  }

  return tombstone;
}

function normalizeSyncIngredient(ingredient, overrides = {}) {
  if (!ingredient) return null;
  const id = ingredient.id || ingredient.clientId;
  const normalized = {
    ...ingredient,
    id,
    clientId: ingredient.clientId || id,
    deletedAt: ingredient.deletedAt || null,
    syncState: ingredient.syncState || SYNC_STATE.CLEAN,
    lastSyncedAt: ingredient.lastSyncedAt || ingredient.updatedAt || null,
    ...overrides
  };

  return isIngredientDeleted(normalized) ? compactIngredientTombstone(normalized) : normalized;
}

export function markIngredientAsSynced(ingredient) {
  return normalizeSyncIngredient(ingredient, {
    syncState: SYNC_STATE.CLEAN,
    lastSyncedAt: ingredient?.updatedAt || new Date().toISOString()
  });
}

export function markIngredientAsPending(ingredient, syncState = SYNC_STATE.PENDING_UPDATE) {
  return normalizeSyncIngredient(ingredient, { syncState });
}

export function getVisibleIngredients(ingredients = []) {
  return ingredients.filter((ingredient) => !isIngredientDeleted(ingredient));
}

export function getPendingIngredients(ingredients = []) {
  return ingredients.filter((ingredient) => isPendingSyncState(ingredient.syncState));
}

export function resolveIngredientConflict({ localIngredient = null, remoteIngredient = null } = {}) {
  if (!localIngredient && !remoteIngredient) return null;
  if (!localIngredient) return markIngredientAsSynced(remoteIngredient);
  if (!remoteIngredient) {
    return isPendingSyncState(localIngredient.syncState) ? normalizeSyncIngredient(localIngredient) : null;
  }

  const localDeleted = isIngredientDeleted(localIngredient);
  const remoteDeleted = isIngredientDeleted(remoteIngredient);
  if (remoteDeleted && !localDeleted) return markIngredientAsSynced(remoteIngredient);
  if (localDeleted && !remoteDeleted) {
    return markIngredientAsPending(localIngredient, SYNC_STATE.PENDING_DELETE);
  }

  const localUpdatedAt = getComparableTimestamp(localIngredient.updatedAt);
  const remoteUpdatedAt = getComparableTimestamp(remoteIngredient.updatedAt);
  const localLastSyncedAt = getComparableTimestamp(localIngredient.lastSyncedAt);

  if (remoteUpdatedAt >= localUpdatedAt) return markIngredientAsSynced(remoteIngredient);
  if (isPendingSyncState(localIngredient.syncState)) return normalizeSyncIngredient(localIngredient);

  if (localUpdatedAt > localLastSyncedAt) {
    return markIngredientAsPending(
      localIngredient,
      isIngredientDeleted(localIngredient) ? SYNC_STATE.PENDING_DELETE : SYNC_STATE.PENDING_UPDATE
    );
  }

  return markIngredientAsSynced(remoteIngredient);
}

export async function syncIngredientSnapshot({
  localIngredients = [],
  remoteIngredients = [],
  strategy = SYNC_STRATEGY
} = {}) {
  const localMap = new Map(localIngredients.map((ingredient) => [getIngredientSyncKey(ingredient), ingredient]));
  const remoteMap = new Map(remoteIngredients.map((ingredient) => [getIngredientSyncKey(ingredient), ingredient]));
  const keys = new Set([...localMap.keys(), ...remoteMap.keys()]);
  const nextSnapshot = [];
  const pendingDownloads = [];
  const conflicts = [];

  keys.forEach((key) => {
    const localIngredient = localMap.get(key) || null;
    const remoteIngredient = remoteMap.get(key) || null;
    const localWasPending = isPendingSyncState(localIngredient?.syncState);
    const remoteWon =
      localIngredient &&
      remoteIngredient &&
      (
        (isIngredientDeleted(remoteIngredient) && !isIngredientDeleted(localIngredient))
        || (
          isIngredientDeleted(remoteIngredient) === isIngredientDeleted(localIngredient)
          && getComparableTimestamp(remoteIngredient.updatedAt) > getComparableTimestamp(localIngredient.updatedAt)
        )
      );
    const resolvedIngredient = resolveIngredientConflict({ localIngredient, remoteIngredient });

    if (!resolvedIngredient) return;

    if (!localIngredient && remoteIngredient) {
      pendingDownloads.push(markIngredientAsSynced(remoteIngredient));
    }

    if (localWasPending && remoteWon) {
      conflicts.push({
        clientId: key,
        localUpdatedAt: localIngredient.updatedAt || null,
        remoteUpdatedAt: remoteIngredient.updatedAt || null,
        resolution: 'remote'
      });
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
    pendingUploads: getPendingIngredients(nextSnapshot),
    pendingDownloads,
    conflicts,
    nextSnapshot
  };
}
