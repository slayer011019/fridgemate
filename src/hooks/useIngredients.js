import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as ingredientsApi from '../api/ingredientsApi';
import { IngredientsApiError } from '../api/ingredientsApi';
import * as indexedDb from '../db/indexedDB';
import { getPreferredDataSource, isBackendEnabled } from '../utils/backendConfig';

const IngredientsContext = createContext(null);

let cachedIngredients = [];
let hasLoadedIngredients = false;
let loadIngredientsPromise = null;

function shouldFallbackToIndexedDb(error) {
  if (!(error instanceof IngredientsApiError)) {
    return false;
  }

  return !error.status || error.status >= 500;
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
  const [ingredients, setIngredients] = useState(() => (hasLoadedIngredients ? cachedIngredients : []));
  const [loading, setLoading] = useState(() => !hasLoadedIngredients);
  const [error, setError] = useState('');
  const [dataSource, setDataSource] = useState(getPreferredDataSource());
  const ingredientsRef = useRef(ingredients);

  const clearError = useCallback(() => {
    setError('');
  }, []);

  const commitIngredients = useCallback((nextValue) => {
    setIngredients((current) => {
      const nextIngredients = typeof nextValue === 'function' ? nextValue(current) : nextValue;
      ingredientsRef.current = nextIngredients;
      cachedIngredients = nextIngredients;
      hasLoadedIngredients = true;
      return nextIngredients;
    });
  }, []);

  useEffect(() => {
    ingredientsRef.current = ingredients;
  }, [ingredients]);

  const runWithFallback = useCallback(async (actionLabel, apiOperation, fallbackOperation) => {
    if (!isBackendEnabled()) {
      setDataSource('indexeddb');
      setError('');
      return fallbackOperation();
    }

    try {
      const result = await apiOperation();
      setDataSource('api');
      setError('');
      return result;
    } catch (nextError) {
      if (!shouldFallbackToIndexedDb(nextError)) {
        setError(nextError.message || 'Failed to process ingredient data.');
        throw nextError;
      }

      console.warn(`[useIngredients] ${actionLabel} failed via API. Falling back to IndexedDB.`, nextError);
      setDataSource('indexeddb');
      setError('API 연결이 불안정해서 브라우저 저장소를 사용 중이에요.');
      return fallbackOperation();
    }
  }, []);

  const loadIngredients = useCallback(
    async ({ force = false } = {}) => {
      if (!force && hasLoadedIngredients) {
        setLoading(false);
        return cachedIngredients;
      }

      if (!force && loadIngredientsPromise) {
        setLoading(true);

        try {
          const items = await loadIngredientsPromise;
          commitIngredients(items);
          return items;
        } finally {
          setLoading(false);
        }
      }

      setLoading(true);

      const task = runWithFallback(
        'loadIngredients',
        () => ingredientsApi.getAllIngredients(),
        () => indexedDb.getAllIngredients()
      ).then((items) => items || []);

      if (!force) {
        loadIngredientsPromise = task;
      }

      try {
        const items = await task;
        commitIngredients(items);
        return items;
      } finally {
        if (!force && loadIngredientsPromise === task) {
          loadIngredientsPromise = null;
        }

        setLoading(false);
      }
    },
    [commitIngredients, runWithFallback]
  );

  useEffect(() => {
    if (hasLoadedIngredients) {
      setLoading(false);
      return;
    }

    loadIngredients().catch(() => {
      setLoading(false);
    });
  }, [loadIngredients]);

  const addIngredient = useCallback(
    async (ingredient) => {
      const optimisticIngredient = ensureIngredientId({ ...ingredient });
      commitIngredients((current) => upsertIngredient(current, optimisticIngredient));

      try {
        const savedIngredient = await runWithFallback(
          'addIngredient',
          () => ingredientsApi.saveIngredient(optimisticIngredient),
          () => indexedDb.saveIngredient(optimisticIngredient).then(() => optimisticIngredient)
        );

        if (savedIngredient) {
          commitIngredients((current) => upsertIngredient(current, savedIngredient));
        }

        return savedIngredient || optimisticIngredient;
      } catch (nextError) {
        commitIngredients((current) => current.filter((item) => item.id !== optimisticIngredient.id));
        throw nextError;
      }
    },
    [commitIngredients, runWithFallback]
  );

  const updateIngredient = useCallback(
    async (ingredient) => {
      const optimisticIngredient = ensureIngredientId({ ...ingredient });
      const previousIndex = ingredientsRef.current.findIndex((item) => item.id === optimisticIngredient.id);
      const previousIngredient = previousIndex >= 0 ? ingredientsRef.current[previousIndex] : null;

      commitIngredients((current) => upsertIngredient(current, optimisticIngredient));

      try {
        const updatedIngredient = await runWithFallback(
          'updateIngredient',
          () => ingredientsApi.saveIngredient(optimisticIngredient),
          () => indexedDb.saveIngredient(optimisticIngredient).then(() => optimisticIngredient)
        );

        if (updatedIngredient) {
          commitIngredients((current) => upsertIngredient(current, updatedIngredient));
        }

        return updatedIngredient || optimisticIngredient;
      } catch (nextError) {
        if (previousIngredient) {
          commitIngredients((current) => restoreIngredient(current, previousIngredient, previousIndex));
        } else {
          commitIngredients((current) => current.filter((item) => item.id !== optimisticIngredient.id));
        }

        throw nextError;
      }
    },
    [commitIngredients, runWithFallback]
  );

  const addIngredients = useCallback(
    async (items) => {
      const optimisticIngredients = items.map((ingredient) => ensureIngredientId({ ...ingredient }));
      const optimisticIds = new Set(optimisticIngredients.map((ingredient) => ingredient.id));

      commitIngredients((current) =>
        optimisticIngredients.reduce((nextItems, ingredient) => upsertIngredient(nextItems, ingredient), current)
      );

      try {
        const savedIngredients = await runWithFallback(
          'addIngredients',
          () => ingredientsApi.saveIngredients(optimisticIngredients),
          () => indexedDb.saveIngredients(optimisticIngredients).then(() => optimisticIngredients)
        );

        if (savedIngredients?.length) {
          commitIngredients((current) =>
            savedIngredients.reduce((nextItems, ingredient) => upsertIngredient(nextItems, ingredient), current)
          );
        }

        return savedIngredients || optimisticIngredients;
      } catch (nextError) {
        commitIngredients((current) => current.filter((ingredient) => !optimisticIds.has(ingredient.id)));
        throw nextError;
      }
    },
    [commitIngredients, runWithFallback]
  );

  const removeIngredient = useCallback(
    async (id) => {
      const previousIndex = ingredientsRef.current.findIndex((ingredient) => ingredient.id === id);
      const previousIngredient = previousIndex >= 0 ? ingredientsRef.current[previousIndex] : null;

      commitIngredients((current) => current.filter((ingredient) => ingredient.id !== id));

      try {
        await runWithFallback(
          'removeIngredient',
          () => ingredientsApi.deleteIngredient(id),
          () => indexedDb.deleteIngredient(id)
        );
      } catch (nextError) {
        if (previousIngredient) {
          commitIngredients((current) => restoreIngredient(current, previousIngredient, previousIndex));
        }

        throw nextError;
      }
    },
    [commitIngredients, runWithFallback]
  );

  const findIngredient = useCallback(
    async (id) => {
      const existingIngredient = ingredientsRef.current.find((ingredient) => ingredient.id === id);

      if (existingIngredient) {
        return existingIngredient;
      }

      const foundIngredient = await runWithFallback(
        'findIngredient',
        () => ingredientsApi.getIngredientById(id),
        () => indexedDb.getIngredientById(id)
      );

      if (foundIngredient) {
        commitIngredients((current) => upsertIngredient(current, foundIngredient));
      }

      return foundIngredient;
    },
    [commitIngredients, runWithFallback]
  );

  const value = useMemo(
    () => ({
      ingredients,
      loading,
      error,
      dataSource,
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
      loadIngredients,
      loading,
      removeIngredient,
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
