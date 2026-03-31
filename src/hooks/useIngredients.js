import { useCallback, useEffect, useState } from 'react';
import { deleteIngredient, getAllIngredients, getIngredientById, saveIngredient, saveIngredients } from '../db/indexedDB';

export function useIngredients() {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadIngredients = useCallback(async () => {
    setLoading(true);

    try {
      const items = await getAllIngredients();
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
      ...ingredient,
      id: crypto.randomUUID()
    };

    await saveIngredient(nextIngredient);
    await loadIngredients();
    return nextIngredient;
  };

  const updateIngredient = async (ingredient) => {
    await saveIngredient(ingredient);
    await loadIngredients();
    return ingredient;
  };

  const addIngredients = async (items) => {
    const nextIngredients = items.map((ingredient) => ({
      ...ingredient,
      id: ingredient.id || crypto.randomUUID()
    }));

    await saveIngredients(nextIngredients);
    await loadIngredients();
    return nextIngredients;
  };

  const removeIngredient = async (id) => {
    await deleteIngredient(id);
    await loadIngredients();
  };

  const findIngredient = useCallback((id) => getIngredientById(id), []);

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
