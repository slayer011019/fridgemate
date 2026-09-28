import {
  findIngredientInRepository,
  ingredientCache,
  loadIngredientsFromRepository,
  pullIngredientsFromServerInRepository,
  pushIngredientsToServerInRepository
} from './ingredientRepository';
import {
  buildScopeOptions,
  createEmptySyncSummary,
  getScopeState,
  setStoredLastSyncedAt
} from './ingredientsScopeState';
import {
  getPendingIngredients,
  getVisibleIngredients,
  markIngredientAsPending,
  markIngredientAsSynced,
  SYNC_STATE,
  syncIngredientSnapshot
} from '../../utils/syncStrategy';

const FALLBACK_WARNING_MESSAGE =
  'The API connection is unstable, so FridgeMate is temporarily using the authenticated local cache.';
const STALE_READ_MESSAGE = '재고 조회를 시작한 계정이나 요청이 바뀌었습니다. 다시 확인해주세요.';

export function ensureIngredientId(ingredient) {
  const id = ingredient.id || crypto.randomUUID();
  return {
    ...ingredient,
    id,
    clientId: ingredient.clientId || id
  };
}

export function upsertIngredient(items, nextIngredient) {
  const nextItems = [...items];
  const existingIndex = nextItems.findIndex((item) => item.id === nextIngredient.id);

  if (existingIndex === -1) {
    nextItems.unshift(nextIngredient);
    return nextItems;
  }

  nextItems[existingIndex] = nextIngredient;
  return nextItems;
}

export function restoreIngredient(items, ingredient, index) {
  const nextItems = [...items];
  const existingIndex = nextItems.findIndex((item) => item.id === ingredient.id);

  if (existingIndex !== -1) {
    nextItems[existingIndex] = ingredient;
    return nextItems;
  }

  const safeIndex = index < 0 ? 0 : Math.min(index, nextItems.length);
  nextItems.splice(safeIndex, 0, ingredient);
  return nextItems;
}

export function createRepositoryCommandRunner({ useApi, setDataSource, setError }) {
  return async function runRepositoryCommand(actionLabel, repositoryOperation, { isCurrent = () => true } = {}) {
    try {
      const { result, source, usedFallback } = await repositoryOperation();
      if (!isCurrent()) throw new Error(STALE_READ_MESSAGE);

      if (!useApi) {
        setDataSource('indexeddb');
        setError('');
        return { result, source, usedFallback };
      }

      if (usedFallback) {
        console.warn(`[useIngredients] ${actionLabel} failed via API. Falling back to IndexedDB.`);
        setDataSource('indexeddb');
        setError(FALLBACK_WARNING_MESSAGE);
        return { result, source, usedFallback };
      }

      setDataSource(source);
      setError('');
      return { result, source, usedFallback };
    } catch (nextError) {
      if (!isCurrent()) throw new Error(STALE_READ_MESSAGE);
      setError(nextError.message || 'Failed to process ingredient data.');
      throw nextError;
    }
  };
}

async function syncIndexedDbCache(actionLabel, operation) {
  try {
    await operation();
  } catch (nextError) {
    console.warn(`[useIngredients] Failed to update IndexedDB cache after ${actionLabel}.`, nextError);
  }
}

export function createLoadIngredientsAction({
  storageScope,
  useApi,
  syncEnabled,
  scopeRef,
  isCurrentSession,
  commitIngredients,
  commitSyncSummary,
  runRepositoryCommand,
  setLoading,
  setHasUnsyncedChanges,
  setSyncStatus
}) {
  return async function loadIngredients({ force = false } = {}) {
    const scopeState = getScopeState(storageScope);
    const isSameSession = () => isCurrentSession() && scopeRef.current === storageScope
      && getScopeState(storageScope) === scopeState;
    if (!isSameSession()) throw new Error(STALE_READ_MESSAGE);

    if (!force && scopeState.loaded) {
      const hasPendingChanges = scopeState.syncSummary.pendingUploads.length > 0;
      setHasUnsyncedChanges(hasPendingChanges);
      if (hasPendingChanges) setSyncStatus('dirty');
      setLoading(false);
      return scopeState.items;
    }

    if (!force && scopeState.promise && scopeState.loadRequest?.isCurrent()) {
      const request = scopeState.loadRequest;
      const isCurrent = () => isSameSession() && request.isCurrent();
      setLoading(true);
      try {
        const { items, sync } = await scopeState.promise;
        if (!isCurrent()) throw new Error(STALE_READ_MESSAGE);
        // Another mounted provider may share the read but owns its own UI state.
        commitIngredients(items, storageScope);
        commitSyncSummary(sync, storageScope);
        const hasPendingChanges = sync.pendingUploads.length > 0;
        setHasUnsyncedChanges(hasPendingChanges);
        if (hasPendingChanges) setSyncStatus('dirty');
        return items;
      } catch (nextError) {
        if (isSameSession() && scopeState.loadRequest === request && !request.isCurrent()) {
          // The shared read's owner left. Read again in this still-active session;
          // never reuse the snapshot captured for the abandoned owner.
          return loadIngredients({ force: true });
        }
        throw nextError;
      } finally {
        if (isCurrent()) setLoading(false);
      }
    }

    const request = { isCurrent: () => isSameSession() && scopeState.loadRequest === request };
    scopeState.loadRequest = request;
    // A different account session must not reuse the pre-refresh cached rows.
    scopeState.loaded = false;
    setLoading(true);

    const task = runRepositoryCommand('loadIngredients', () =>
      loadIngredientsFromRepository({
        scope: storageScope,
        useApi
      }),
      { isCurrent: request.isCurrent }
    ).then(async ({ result, source }) => {
      if (!request.isCurrent()) throw new Error(STALE_READ_MESSAGE);
      let items = result || [];
      let nextSyncSummary = createEmptySyncSummary();

      if (source === 'api') {
        const localIngredients = await ingredientCache.getAllForSync(buildScopeOptions(storageScope));
        if (!request.isCurrent()) throw new Error(STALE_READ_MESSAGE);
        nextSyncSummary = await syncIngredientSnapshot({
          localIngredients,
          remoteIngredients: items
        });
        if (!request.isCurrent()) throw new Error(STALE_READ_MESSAGE);
        items = getVisibleIngredients(nextSyncSummary.nextSnapshot);
        await syncIndexedDbCache('loadIngredients', () =>
          ingredientCache.replaceAll(nextSyncSummary.nextSnapshot, buildScopeOptions(storageScope))
        );
      } else if (syncEnabled) {
        const localIngredients = await ingredientCache.getAllForSync(buildScopeOptions(storageScope));
        if (!request.isCurrent()) throw new Error(STALE_READ_MESSAGE);
        const pendingUploads = getPendingIngredients(localIngredients);
        nextSyncSummary = {
          ...createEmptySyncSummary(),
          pendingUploads,
          nextSnapshot: localIngredients
        };
        items = getVisibleIngredients(localIngredients);
      }

      return {
        items,
        sync: nextSyncSummary
      };
    });

    scopeState.promise = task;

    try {
      const { items, sync } = await task;
      if (!request.isCurrent()) throw new Error(STALE_READ_MESSAGE);
      commitIngredients(items, storageScope);
      commitSyncSummary(sync, storageScope);
      const hasPendingChanges = sync.pendingUploads.length > 0;
      setHasUnsyncedChanges(hasPendingChanges);
      if (hasPendingChanges) setSyncStatus('dirty');

      return items;
    } finally {
      if (scopeState.promise === task) scopeState.promise = null;

      if (request.isCurrent()) {
        setLoading(false);
      }
    }
  };
}

export function createCrudActions({
  storageScope,
  syncEnabled,
  ingredientsRef,
  commitIngredients,
  commitSyncSummary,
  runRepositoryCommand,
  markDirty
}) {
  const prepareLocalIngredient = (ingredient, pendingState) => {
    if (!syncEnabled) return ingredient;

    const now = new Date().toISOString();
    return markIngredientAsPending(
      {
        ...ingredient,
        createdAt: ingredient.createdAt || now,
        updatedAt: now,
        deletedAt: null
      },
      pendingState
    );
  };

  const refreshLocalSyncSummary = async () => {
    if (!syncEnabled) {
      commitSyncSummary(createEmptySyncSummary(), storageScope);
      return;
    }

    try {
      const localIngredients = await ingredientCache.getAllForSync(buildScopeOptions(storageScope));
      commitSyncSummary(
        {
          ...createEmptySyncSummary(),
          pendingUploads: getPendingIngredients(localIngredients),
          nextSnapshot: localIngredients
        },
        storageScope
      );
    } catch (nextError) {
      console.warn('[useIngredients] Failed to refresh local sync metadata.', nextError);
    }
  };

  const saveLocalIngredient = async (ingredient) => {
    await ingredientCache.save(ingredient, buildScopeOptions(storageScope));
    await refreshLocalSyncSummary();
    markDirty();
  };

  const saveLocalIngredients = async (ingredients) => {
    await ingredientCache.saveMany(ingredients, buildScopeOptions(storageScope));
    await refreshLocalSyncSummary();
    markDirty();
  };

  const removeLocalIngredient = async (id) => {
    await ingredientCache.remove(id, buildScopeOptions(storageScope));
    commitSyncSummary(createEmptySyncSummary(), storageScope);
    markDirty();
  };

  return {
    async addIngredient(ingredient) {
      const optimisticIngredient = prepareLocalIngredient(
        ensureIngredientId({ ...ingredient }),
        SYNC_STATE.PENDING_CREATE
      );
      commitIngredients((current) => upsertIngredient(current, optimisticIngredient));

      try {
        await saveLocalIngredient(optimisticIngredient);
        return optimisticIngredient;
      } catch (nextError) {
        commitIngredients((current) => current.filter((item) => item.id !== optimisticIngredient.id));
        throw nextError;
      }
    },

    async updateIngredient(ingredient) {
      const existingIngredient = ingredientsRef.current.find((item) => item.id === ingredient.id);
      const pendingState =
        existingIngredient?.syncState === SYNC_STATE.PENDING_CREATE
          ? SYNC_STATE.PENDING_CREATE
          : SYNC_STATE.PENDING_UPDATE;
      const optimisticIngredient = prepareLocalIngredient(ensureIngredientId({ ...ingredient }), pendingState);
      const previousIndex = ingredientsRef.current.findIndex((item) => item.id === optimisticIngredient.id);
      const previousIngredient = previousIndex >= 0 ? ingredientsRef.current[previousIndex] : null;

      commitIngredients((current) => upsertIngredient(current, optimisticIngredient));

      try {
        await saveLocalIngredient(optimisticIngredient);
        return optimisticIngredient;
      } catch (nextError) {
        if (previousIngredient) {
          commitIngredients((current) => restoreIngredient(current, previousIngredient, previousIndex));
        } else {
          commitIngredients((current) => current.filter((item) => item.id !== optimisticIngredient.id));
        }

        throw nextError;
      }
    },

    async addIngredients(items) {
      const optimisticIngredients = items.map((ingredient) =>
        prepareLocalIngredient(ensureIngredientId({ ...ingredient }), SYNC_STATE.PENDING_CREATE)
      );
      const optimisticIds = new Set(optimisticIngredients.map((ingredient) => ingredient.id));

      commitIngredients((current) =>
        optimisticIngredients.reduce((nextItems, ingredient) => upsertIngredient(nextItems, ingredient), current)
      );

      try {
        await saveLocalIngredients(optimisticIngredients);
        return optimisticIngredients;
      } catch (nextError) {
        commitIngredients((current) => current.filter((ingredient) => !optimisticIds.has(ingredient.id)));
        throw nextError;
      }
    },

    async removeIngredient(id) {
      const previousIndex = ingredientsRef.current.findIndex((ingredient) => ingredient.id === id);
      const previousIngredient = previousIndex >= 0 ? ingredientsRef.current[previousIndex] : null;

      commitIngredients((current) => current.filter((ingredient) => ingredient.id !== id));

      try {
        if (syncEnabled && previousIngredient) {
          const deletedAt = new Date().toISOString();
          const tombstone = {
            id: previousIngredient.id,
            clientId: previousIngredient.clientId || previousIngredient.id,
            updatedAt: deletedAt,
            deletedAt
          };
          if (Object.hasOwn(previousIngredient, 'userId')) {
            tombstone.userId = previousIngredient.userId;
          }
          await saveLocalIngredient(
            markIngredientAsPending(
              tombstone,
              SYNC_STATE.PENDING_DELETE
            )
          );
        } else {
          await removeLocalIngredient(id);
        }
      } catch (nextError) {
        if (previousIngredient) {
          commitIngredients((current) => restoreIngredient(current, previousIngredient, previousIndex));
        }

        throw nextError;
      }
    },

    async findIngredient(id) {
      const existingIngredient = ingredientsRef.current.find((ingredient) => ingredient.id === id);

      if (existingIngredient) {
        return existingIngredient;
      }

      const { result: foundIngredient, source } = await runRepositoryCommand('findIngredient', () =>
        findIngredientInRepository({
          id,
          scope: storageScope,
          useApi: false
        })
      );

      const committedIngredient =
        source === 'api' && foundIngredient ? markIngredientAsSynced(foundIngredient) : foundIngredient;

      if (source === 'api' && committedIngredient) {
        await syncIndexedDbCache('findIngredient', () =>
          ingredientCache.save(committedIngredient, buildScopeOptions(storageScope))
        );
      }

      if (committedIngredient) {
        commitIngredients((current) => upsertIngredient(current, committedIngredient));
      }

      return committedIngredient;
    }
  };
}

export function createPushAction({
  isAuthenticated,
  storageScope,
  commitIngredients,
  commitSyncSummary,
  setSyncStatus,
  setHasUnsyncedChanges,
  setLastSyncedAt,
  setSyncError,
  setError
}) {
  return async function pushIngredientsToServer() {
    if (!isAuthenticated) {
      const message = '로그인이 필요합니다.';
      setSyncStatus('error');
      setHasUnsyncedChanges(true);
      setSyncError(message);
      setError(message);
      return { ok: false, message };
    }

    setSyncStatus('syncing');
    setSyncError(null);
    setError('');

    try {
      const localIngredients = await ingredientCache.getAllForSync(buildScopeOptions(storageScope));
      const pendingIngredients = getPendingIngredients(localIngredients);
      const response = await pushIngredientsToServerInRepository(
        pendingIngredients.map(({ lastSyncedAt, syncState, ...ingredient }) => ({
          ...ingredient,
          clientId: ingredient.clientId || ingredient.id
        }))
      );
      const remoteIngredients = Array.isArray(response) ? response : response.items || [];
      const syncSummary = await syncIngredientSnapshot({ localIngredients, remoteIngredients });
      const now = new Date().toISOString();
      const nextSnapshot = syncSummary.nextSnapshot;
      const nextIngredients = getVisibleIngredients(nextSnapshot);
      const hasPendingChanges = syncSummary.pendingUploads.length > 0;

      await ingredientCache.replaceAll(nextSnapshot, buildScopeOptions(storageScope));
      commitIngredients(nextIngredients, storageScope);
      commitSyncSummary(syncSummary, storageScope);
      setStoredLastSyncedAt(storageScope, now);
      setLastSyncedAt(now);
      setSyncStatus(hasPendingChanges ? 'dirty' : 'synced');
      setHasUnsyncedChanges(hasPendingChanges);
      setSyncError(null);

      return {
        ok: true,
        syncedCount: Number.isInteger(response?.appliedCount) ? response.appliedCount : pendingIngredients.length,
        lastSyncedAt: now
      };
    } catch (nextError) {
      const message = nextError.message || 'API request could not reach the server.';
      setSyncStatus('error');
      setHasUnsyncedChanges(true);
      setSyncError(message);
      setError(message);
      return { ok: false, message };
    }
  };
}

export function createPullAction({
  isAuthenticated,
  storageScope,
  commitIngredients,
  commitSyncSummary,
  setSyncStatus,
  setHasUnsyncedChanges,
  setSyncError,
  setError
}) {
  return async function pullIngredientsFromServer() {
    if (!isAuthenticated) {
      const message = '로그인이 필요합니다.';
      setSyncStatus('error');
      setSyncError(message);
      setError(message);
      return { ok: false, message };
    }

    setSyncStatus('syncing');
    setSyncError(null);
    setError('');

    try {
      const response = await pullIngredientsFromServerInRepository();
      const remoteIngredients = Array.isArray(response) ? response : response.items || [];
      const localIngredients = await ingredientCache.getAllForSync(buildScopeOptions(storageScope));
      const syncSummary = await syncIngredientSnapshot({ localIngredients, remoteIngredients });
      const nextSnapshot = syncSummary.nextSnapshot;
      const nextIngredients = getVisibleIngredients(nextSnapshot);
      const hasPendingChanges = syncSummary.pendingUploads.length > 0;

      await ingredientCache.replaceAll(nextSnapshot, buildScopeOptions(storageScope));
      commitIngredients(nextIngredients, storageScope);
      commitSyncSummary(syncSummary, storageScope);
      setSyncStatus(hasPendingChanges ? 'dirty' : 'synced');
      setHasUnsyncedChanges(hasPendingChanges);
      setSyncError(null);

      return {
        ok: true,
        syncedCount: nextIngredients.length
      };
    } catch (nextError) {
      const message = nextError.message || 'API request could not reach the server.';
      setSyncStatus('error');
      setSyncError(message);
      setError(message);
      return { ok: false, message };
    }
  };
}
