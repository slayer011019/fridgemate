import { useCallback, useEffect, useState } from 'react';
import * as ingredientsApi from '../api/ingredientsApi';
import { IngredientsApiError } from '../api/ingredientsApi';
import * as indexedDb from '../db/indexedDB';
import { getPreferredDataSource, isBackendEnabled } from '../utils/backendConfig';

function shouldFallbackToIndexedDb(error) {
  if (!(error instanceof IngredientsApiError)) {
    return false;
  }

  return !error.status || error.status >= 500;
}

function ensureIndexedDbIngredientId(ingredient) {
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

export function useIngredients() {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dataSource, setDataSource] = useState(getPreferredDataSource());

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
      setError('API 연결에 실패해서 브라우저 저장소를 사용 중이에요.');
      return fallbackOperation();
    }
  }, []);

  const loadIngredients = useCallback(async () => {
    setLoading(true);

    try {
      const items = await runWithFallback(
        'loadIngredients',
        () => ingredientsApi.getAllIngredients(),
        () => indexedDb.getAllIngredients()
      );
      setIngredients(items || []);
    } finally {
      setLoading(false);
    }
  }, [runWithFallback]);

  useEffect(() => {
    loadIngredients();
  }, [loadIngredients]);

  const addIngredient = useCallback(async (ingredient) => {
    const nextIngredient = {
      ...ingredient
    };

    const savedIngredient = await runWithFallback(
      'addIngredient',
      () => ingredientsApi.saveIngredient(nextIngredient),
      () => {
        const fallbackIngredient = ensureIndexedDbIngredientId(nextIngredient);
        return indexedDb.saveIngredient(fallbackIngredient).then(() => fallbackIngredient);
      }
    );

    if (savedIngredient) {
      setIngredients((current) => upsertIngredient(current, savedIngredient));
    }

    return savedIngredient || nextIngredient;
  }, [runWithFallback]);

  const updateIngredient = useCallback(async (ingredient) => {
    const updatedIngredient = await runWithFallback(
      'updateIngredient',
      () => ingredientsApi.saveIngredient(ingredient),
      () => {
        const fallbackIngredient = ensureIndexedDbIngredientId(ingredient);
        return indexedDb.saveIngredient(fallbackIngredient).then(() => fallbackIngredient);
      }
    );

    if (updatedIngredient) {
      setIngredients((current) => upsertIngredient(current, updatedIngredient));
    }

    return updatedIngredient || ingredient;
  }, [runWithFallback]);

  const addIngredients = useCallback(async (items) => {
    const nextIngredients = items.map((ingredient) => ({ ...ingredient }));

    const savedIngredients = await runWithFallback(
      'addIngredients',
      () =>
        ingredientsApi.saveIngredients(
          nextIngredients.map((ingredient) => ({
            ...ingredient,
            id: undefined
          }))
        ),
      () => {
        const fallbackIngredients = nextIngredients.map((ingredient) => ensureIndexedDbIngredientId(ingredient));
        return indexedDb.saveIngredients(fallbackIngredients).then(() => fallbackIngredients);
      }
    );

    if (savedIngredients?.length) {
      setIngredients((current) => savedIngredients.reduce((nextItems, ingredient) => upsertIngredient(nextItems, ingredient), current));
    }

    return savedIngredients || nextIngredients;
  }, [runWithFallback]);

  const removeIngredient = useCallback(async (id) => {
    await runWithFallback(
      'removeIngredient',
      () => ingredientsApi.deleteIngredient(id),
      () => indexedDb.deleteIngredient(id)
    );
    setIngredients((current) => current.filter((ingredient) => ingredient.id !== id));
  }, [runWithFallback]);

  const findIngredient = useCallback(
    (id) =>
      runWithFallback(
        'findIngredient',
        () => ingredientsApi.getIngredientById(id),
        () => indexedDb.getIngredientById(id)
      ),
    [runWithFallback]
  );

  return {
    ingredients,
    loading,
    error,
    dataSource,
    loadIngredients,
    addIngredient,
    addIngredients,
    updateIngredient,
    removeIngredient,
    findIngredient
  };
}
