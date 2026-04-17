import { useMemo } from 'react';
import { seedRecipes } from '../data/seedRecipes';
import { getUpcomingIngredients } from '../features/ingredients/ingredientSelectors';
import { useIngredients } from './useIngredients';
import { usePantryStaples } from './usePantryStaples';
import { getDashboardSummary } from '../utils/date';
import { getTopRecommendations } from '../utils/recommendations';

export function useHomePageModel() {
  const { ingredients, loading } = useIngredients();
  const { pantryOwnership } = usePantryStaples();
  const summary = useMemo(() => getDashboardSummary(ingredients), [ingredients]);
  const topRecommendations = useMemo(
    () => getTopRecommendations(seedRecipes, ingredients, 3, { pantryOwnership }),
    [ingredients, pantryOwnership]
  );
  const upcomingItems = useMemo(() => getUpcomingIngredients(ingredients, 4), [ingredients]);
  const urgentCount = summary.expired + summary.expiringSoon;

  return {
    loading,
    summary,
    topRecommendations,
    upcomingItems,
    urgentCount
  };
}
