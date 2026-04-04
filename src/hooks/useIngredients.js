import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  findIngredientInRepository,
  ingredientCache,
  loadIngredientsFromRepository,
  removeIngredientFromRepository,
  saveIngredientInRepository,
  saveIngredientsInRepository
} from '../features/ingredients/ingredientRepository';
import { getPreferredDataSource, isBackendEnabled } from '../utils/backendConfig';
import { markIngredientAsSynced, SYNC_STATE, SYNC_STRATEGY, syncIngredientSnapshot } from '../utils/syncStrategy';
import { useAuth } from './useAuth';

const IngredientsContext = createContext(null);
const FALLBACK_WARNING_MESSAGE =
  'The API connection is unstable, so FridgeMate is temporarily using the authenticated local cache.';
const scopeStateCache = new Map();

function createEmptySyncSummary() {
  return {
    strategy: SYNC_STRATEGY,
    pendingUploads: [],
    pendingDownloads: [],
    conflicts: [],
    nextSnapshot: []
  };
}

function getScopeState(scope) {
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

function buildScopeOptions(scope) {
  return { scope };
}

function ensureIngredientId(ingredient) {
  return ingredient.id ? ingredient : { ...ingredient, id: crypto.randomUUID() };
}

function upsertIngredient(items, nextIngredient) {
  const nextItems = [...items];
  const existingIndex = nextItems.findIndex((item) => item.id === nextIngredient.id);

  if (existingIndex === -1) {
    nextItems.unshift(nextIngredient);
    return nextItems;
  }

  nextItems[existingIndex] = nextIngredient;
  return nextItems;
}

function restoreIngredient(items, ingredient, index) {
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

export function IngredientsProvider({ children }) {
  const { isAuthenticated, loading: authLoading, storageScope } = useAuth();
  const useApi = isBackendEnabled() && isAuthenticated;
  const initialScopeState = getScopeState(storageScope);
  const [ingredients, setIngredients] = useState(() => (initialScopeState.loaded ? initialScopeState.items : []));
  const [loading, setLoading] = useState(() => authLoading || !initialScopeState.loaded);
  const [error, setError] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [dataSource, setDataSource] = useState(() => (useApi ? getPreferredDataSource() : 'indexeddb'));
  const [syncSummary, setSyncSummary] = useState(() => initialScopeState.syncSummary || createEmptySyncSummary());
  const ingredientsRef = useRef(ingredients);
  const activeSyncCountRef = useRef(0);
  const scopeRef = useRef(storageScope);

  const clearError = useCallback(() => {
    setError('');
  }, []);

  const commitIngredients = useCallback((nextValue, targetScope = scopeRef.current) => {
    const scopeState = getScopeState(targetScope);
    const currentItems = targetScope === scopeRef.current ? ingredientsRef.current : scopeState.items;
    const nextIngredients = typeof nextValue === 'function' ? nextValue(currentItems) : nextValue;

    scopeState.items = nextIngredients;
    scopeState.loaded = true;

    if (targetScope === scopeRef.current) {
      ingredientsRef.current = nextIngredients;
      setIngredients(nextIngredients);
    }
  }, []);

  const commitSyncSummary = useCallback((nextSummary, targetScope = scopeRef.current) => {
    const scopeState = getScopeState(targetScope);
    scopeState.syncSummary = nextSummary;

    if (targetScope === scopeRef.current) {
      setSyncSummary(nextSummary);
    }
  }, []);

  useEffect(() => {
    const nextScopeState = getScopeState(storageScope);
    scopeRef.current = storageScope;
    ingredientsRef.current = nextScopeState.items;
    activeSyncCountRef.current = 0;
    setIngredients(nextScopeState.loaded ? nextScopeState.items : []);
    setLoading(authLoading || !nextScopeState.loaded);
    setError('');
    setIsSyncing(false);
    setDataSource(useApi ? 'api' : 'indexeddb');
    setSyncSummary(nextScopeState.syncSummary || createEmptySyncSummary());
  }, [authLoading, storageScope, useApi]);

  useEffect(() => {
    ingredientsRef.current = ingredients;
  }, [ingredients]);

  const startSync = useCallback(() => {
    activeSyncCountRef.current += 1;
    setIsSyncing(true);
  }, []);

  const finishSync = useCallback(() => {
    activeSyncCountRef.current = Math.max(0, activeSyncCountRef.current - 1);
    setIsSyncing(activeSyncCountRef.current > 0);
  }, []);

  const syncIndexedDbCache = useCallback(async (actionLabel, operation) => {
    try {
      await operation();
    } catch (nextError) {
      console.warn(`[useIngredients] Failed to update IndexedDB cache after ${actionLabel}.`, nextError);
    }
  }, []);

  const runRepositoryCommand = useCallback(
    async (actionLabel, repositoryOperation) => {
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
    },
    [useApi]
  );

  const loadIngredients = useCallback(
    async ({ force = false } = {}) => {
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
    },
    [authLoading, commitIngredients, commitSyncSummary, runRepositoryCommand, storageScope, syncIndexedDbCache, useApi]
  );

  useEffect(() => {
    if (authLoading) {
      return;
    }

    const scopeState = getScopeState(storageScope);

    if (scopeState.loaded) {
      setLoading(false);
      return;
    }

    loadIngredients().catch(() => {
      setLoading(false);
    });
  }, [authLoading, loadIngredients, storageScope]);

  const addIngredient = useCallback(
    async (ingredient) => {
      const optimisticIngredient = ensureIngredientId({ ...ingredient });
      commitIngredients((current) => upsertIngredient(current, optimisticIngredient));
      startSync();

      try {
        const { result: savedIngredient, source } = await runRepositoryCommand('addIngredient', () =>
          saveIngredientInRepository({
            ingredient: optimisticIngredient,
            scope: storageScope,
            useApi,
            pendingSyncState: SYNC_STATE.PENDING_CREATE
          })
        );

        const committedIngredient =
          source === 'api' && savedIngredient ? markIngredientAsSynced(savedIngredient) : savedIngredient;

        if (source === 'api' && committedIngredient) {
          await syncIndexedDbCache('addIngredient', () =>
            ingredientCache.save(committedIngredient, buildScopeOptions(storageScope))
          );
          commitSyncSummary(createEmptySyncSummary(), storageScope);
        }

        if (committedIngredient) {
          commitIngredients((current) => upsertIngredient(current, committedIngredient));
        }

        return committedIngredient || optimisticIngredient;
      } catch (nextError) {
        commitIngredients((current) => current.filter((item) => item.id !== optimisticIngredient.id));
        throw nextError;
      } finally {
        finishSync();
      }
    },
    [commitIngredients, commitSyncSummary, finishSync, runRepositoryCommand, startSync, storageScope, syncIndexedDbCache, useApi]
  );

  const updateIngredient = useCallback(
    async (ingredient) => {
      const optimisticIngredient = ensureIngredientId({ ...ingredient });
      const previousIndex = ingredientsRef.current.findIndex((item) => item.id === optimisticIngredient.id);
      const previousIngredient = previousIndex >= 0 ? ingredientsRef.current[previousIndex] : null;

      commitIngredients((current) => upsertIngredient(current, optimisticIngredient));
      startSync();

      try {
        const { result: updatedIngredient, source } = await runRepositoryCommand('updateIngredient', () =>
          saveIngredientInRepository({
            ingredient: optimisticIngredient,
            scope: storageScope,
            useApi,
            pendingSyncState: SYNC_STATE.PENDING_UPDATE
          })
        );

        const committedIngredient =
          source === 'api' && updatedIngredient ? markIngredientAsSynced(updatedIngredient) : updatedIngredient;

        if (source === 'api' && committedIngredient) {
          await syncIndexedDbCache('updateIngredient', () =>
            ingredientCache.save(committedIngredient, buildScopeOptions(storageScope))
          );
          commitSyncSummary(createEmptySyncSummary(), storageScope);
        }

        if (committedIngredient) {
          commitIngredients((current) => upsertIngredient(current, committedIngredient));
        }

        return committedIngredient || optimisticIngredient;
      } catch (nextError) {
        if (previousIngredient) {
          commitIngredients((current) => restoreIngredient(current, previousIngredient, previousIndex));
        } else {
          commitIngredients((current) => current.filter((item) => item.id !== optimisticIngredient.id));
        }

        throw nextError;
      } finally {
        finishSync();
      }
    },
    [commitIngredients, commitSyncSummary, finishSync, runRepositoryCommand, startSync, storageScope, syncIndexedDbCache, useApi]
  );

  const addIngredients = useCallback(
    async (items) => {
      const optimisticIngredients = items.map((ingredient) => ensureIngredientId({ ...ingredient }));
      const optimisticIds = new Set(optimisticIngredients.map((ingredient) => ingredient.id));

      commitIngredients((current) =>
        optimisticIngredients.reduce((nextItems, ingredient) => upsertIngredient(nextItems, ingredient), current)
      );
      startSync();

      try {
        const { result: savedIngredients, source } = await runRepositoryCommand('addIngredients', () =>
          saveIngredientsInRepository({
            ingredients: optimisticIngredients,
            scope: storageScope,
            useApi,
            pendingSyncState: SYNC_STATE.PENDING_CREATE
          })
        );

        const committedIngredients =
          source === 'api' ? savedIngredients.map((ingredient) => markIngredientAsSynced(ingredient)) : savedIngredients;

        if (source === 'api' && committedIngredients.length) {
          await syncIndexedDbCache('addIngredients', () =>
            ingredientCache.saveMany(committedIngredients, buildScopeOptions(storageScope))
          );
          commitSyncSummary(createEmptySyncSummary(), storageScope);
        }

        if (committedIngredients.length) {
          commitIngredients((current) =>
            committedIngredients.reduce((nextItems, ingredient) => upsertIngredient(nextItems, ingredient), current)
          );
        }

        return committedIngredients || optimisticIngredients;
      } catch (nextError) {
        commitIngredients((current) => current.filter((ingredient) => !optimisticIds.has(ingredient.id)));
        throw nextError;
      } finally {
        finishSync();
      }
    },
    [commitIngredients, commitSyncSummary, finishSync, runRepositoryCommand, startSync, storageScope, syncIndexedDbCache, useApi]
  );

  const removeIngredient = useCallback(
    async (id) => {
      const previousIndex = ingredientsRef.current.findIndex((ingredient) => ingredient.id === id);
      const previousIngredient = previousIndex >= 0 ? ingredientsRef.current[previousIndex] : null;

      commitIngredients((current) => current.filter((ingredient) => ingredient.id !== id));
      startSync();

      try {
        const { source } = await runRepositoryCommand('removeIngredient', () =>
          removeIngredientFromRepository({
            id,
            scope: storageScope,
            useApi,
            allowFallback: !useApi
          })
        );

        if (source === 'api') {
          await syncIndexedDbCache('removeIngredient', () =>
            ingredientCache.remove(id, buildScopeOptions(storageScope))
          );
          commitSyncSummary(createEmptySyncSummary(), storageScope);
        }
      } catch (nextError) {
        if (previousIngredient) {
          commitIngredients((current) => restoreIngredient(current, previousIngredient, previousIndex));
        }

        throw nextError;
      } finally {
        finishSync();
      }
    },
    [commitIngredients, commitSyncSummary, finishSync, runRepositoryCommand, startSync, storageScope, syncIndexedDbCache, useApi]
  );

  const findIngredient = useCallback(
    async (id) => {
      const existingIngredient = ingredientsRef.current.find((ingredient) => ingredient.id === id);

      if (existingIngredient) {
        return existingIngredient;
      }

      const { result: foundIngredient, source } = await runRepositoryCommand('findIngredient', () =>
        findIngredientInRepository({
          id,
          scope: storageScope,
          useApi
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
    },
    [commitIngredients, runRepositoryCommand, storageScope, syncIndexedDbCache, useApi]
  );

  const value = useMemo(
    () => ({
      ingredients,
      loading,
      isSyncing,
      error,
      dataSource,
      syncSummary,
      clearError,
      loadIngredients,
      addIngredient,
      addIngredients,
      updateIngredient,
      removeIngredient,
      findIngredient
    }),
    [
      addIngredient,
      addIngredients,
      clearError,
      dataSource,
      error,
      findIngredient,
      ingredients,
      isSyncing,
      loadIngredients,
      loading,
      removeIngredient,
      syncSummary,
      updateIngredient
    ]
  );

  return createElement(IngredientsContext.Provider, { value }, children);
}

export function useIngredients() {
  const context = useContext(IngredientsContext);

  if (!context) {
    throw new Error('useIngredients must be used within IngredientsProvider.');
  }

  return context;
}
