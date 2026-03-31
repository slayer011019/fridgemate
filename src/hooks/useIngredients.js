import { useCallback, useEffect, useState } from 'react';
import * as ingredientsApi from '../api/ingredientsApi';
import * as indexedDb from '../db/indexedDB';
import { isBackendEnabled } from '../utils/backendConfig';

const ingredientRepository = isBackendEnabled() ? ingredientsApi : indexedDb;

export function useIngredients() {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadIngredients = useCallback(async () => {
    setLoading(true);

    try {
      const items = await ingredientRepository.getAllIngredients();
      setIngredients(items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIngredients();
  }, [loadIngredients]);

  const addIngredient = async (ingredient) => {
    const nextIngredient = {
      ...ingredient
    };

    await ingredientRepository.saveIngredient(nextIngredient);
    await loadIngredients();
    return nextIngredient;
  };

  const updateIngredient = async (ingredient) => {
    await ingredientRepository.saveIngredient(ingredient);
    await loadIngredients();
    return ingredient;
  };

  const addIngredients = async (items) => {
    const nextIngredients = items.map((ingredient) => ({
      ...ingredient,
      id: isBackendEnabled() ? undefined : ingredient.id || crypto.randomUUID()
    }));

    await ingredientRepository.saveIngredients(nextIngredients);
    await loadIngredients();
    return nextIngredients;
  };

  const removeIngredient = async (id) => {
    await ingredientRepository.deleteIngredient(id);
    await loadIngredients();
  };

  const findIngredient = useCallback((id) => ingredientRepository.getIngredientById(id), []);

  return {
    ingredients,
    loading,
    loadIngredients,
    addIngredient,
    addIngredients,
    updateIngredient,
    removeIngredient,
    findIngredient
  };
}
