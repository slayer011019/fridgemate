import {
  findIngredientInRepository,
  ingredientCache,
  loadIngredientsFromRepository,
  syncIngredientsToServerInRepository
} from './ingredientRepository';
import { buildScopeOptions, createEmptySyncSummary, getScopeState } from './ingredientsScopeState';
import { markIngredientAsSynced, syncIngredientSnapshot } from '../../utils/syncStrategy';

const FALLBACK_WARNING_MESSAGE =
  'The API connection is unstable, so FridgeMate is temporarily using the authenticated local cache.';

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
  return async function runRepositoryCommand(actionLabel, repositoryOperation) {
    try {
      const { result, source, usedFallback } = await repositoryOperation();

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
  authLoading,
  storageScope,
  useApi,
  scopeRef,
  commitIngredients,
  commitSyncSummary,
  runRepositoryCommand,
  setLoading
}) {
  return async function loadIngredients({ force = false } = {}) {
    if (authLoading) {
      return getScopeState(storageScope).items;
    }

    const scopeState = getScopeState(storageScope);

    if (!force && scopeState.loaded) {
      setLoading(false);
      return scopeState.items;
    }

    if (!force && scopeState.promise) {
      setLoading(true);

      try {
        const { items, sync } = await scopeState.promise;

        if (scopeRef.current === storageScope) {
          commitIngredients(items, storageScope);
          commitSyncSummary(sync, storageScope);
        }

        return items;
      } finally {
        if (scopeRef.current === storageScope) {
          setLoading(false);
        }
      }
    }

    setLoading(true);

    const task = runRepositoryCommand('loadIngredients', () =>
      loadIngredientsFromRepository({
        scope: storageScope,
        useApi
      })
    ).then(async ({ result, source }) => {
      let items = result || [];
      let nextSyncSummary = createEmptySyncSummary();

      if (source === 'api') {
        const localIngredients = await ingredientCache.getAll(buildScopeOptions(storageScope));
        nextSyncSummary = await syncIngredientSnapshot({
          localIngredients,
          remoteIngredients: items
        });
        items = nextSyncSummary.nextSnapshot;
        await syncIndexedDbCache('loadIngredients', () =>
          ingredientCache.replaceAll(items, buildScopeOptions(storageScope))
        );
      }

      return {
        items,
        sync: nextSyncSummary
      };
    });

    scopeState.promise = task;

    try {
      const { items, sync } = await task;

      if (scopeRef.current === storageScope) {
        commitIngredients(items, storageScope);
        commitSyncSummary(sync, storageScope);
      }

      return items;
    } finally {
      scopeState.promise = null;

      if (scopeRef.current === storageScope) {
        setLoading(false);
      }
    }
  };
}

export function createCrudActions({
  storageScope,
  ingredientsRef,
  commitIngredients,
  commitSyncSummary,
  runRepositoryCommand,
  markDirty
}) {
  const saveLocalIngredient = async (ingredient) => {
    await ingredientCache.save(ingredient, buildScopeOptions(storageScope));
    commitSyncSummary(createEmptySyncSummary(), storageScope);
    markDirty();
  };

  const saveLocalIngredients = async (ingredients) => {
    await ingredientCache.saveMany(ingredients, buildScopeOptions(storageScope));
    commitSyncSummary(createEmptySyncSummary(), storageScope);
    markDirty();
  };

  const removeLocalIngredient = async (id) => {
    await ingredientCache.remove(id, buildScopeOptions(storageScope));
    commitSyncSummary(createEmptySyncSummary(), storageScope);
    markDirty();
  };

  return {
    async addIngredient(ingredient) {
      const optimisticIngredient = ensureIngredientId({ ...ingredient });
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
      const optimisticIngredient = ensureIngredientId({ ...ingredient });
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
      const optimisticIngredients = items.map((ingredient) => ensureIngredientId({ ...ingredient }));
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
        await removeLocalIngredient(id);
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

export function createManualSyncAction({
  isAuthenticated,
  storageScope,
  commitIngredients,
  setSyncStatus,
  setHasUnsyncedChanges,
  setLastSyncedAt,
  setSyncError,
  setError
}) {
  return async function syncIngredientsToServer() {
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
      const localIngredients = await ingredientCache.getAll(buildScopeOptions(storageScope));
      const syncedIngredients = await syncIngredientsToServerInRepository(
        localIngredients.map(({ lastSyncedAt, syncState, ...ingredient }) => ({
          ...ingredient,
          clientId: ingredient.clientId || ingredient.id
        }))
      );
      const now = new Date().toISOString();
      const nextIngredients = syncedIngredients.map((ingredient) => markIngredientAsSynced(ingredient));

      await ingredientCache.replaceAll(nextIngredients, buildScopeOptions(storageScope));
      commitIngredients(nextIngredients, storageScope);
      window.localStorage.setItem('fridgemate-last-synced-at', now);
      setLastSyncedAt(now);
      setSyncStatus('synced');
      setHasUnsyncedChanges(false);
      setSyncError(null);

      return {
        ok: true,
        syncedCount: nextIngredients.length,
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
