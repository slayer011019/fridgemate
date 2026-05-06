import { useMemo } from 'react';
import { seedRecipes } from '../data/seedRecipes';
import { useIngredients } from './useIngredients';
import { buildRecipeRecommendations } from '../utils/recommendations';

export function useLocalRecommendations(pantryItems = []) {
  const { ingredients, loading } = useIngredients();
  const recommendations = useMemo(
    () => buildRecipeRecommendations(seedRecipes, ingredients, { pantryItems }),
    [ingredients, pantryItems]
  );

  return {
    recommendations,
    loading,
    ingredients
  };
}
