import { useEffect, useMemo, useRef, useState } from 'react';
import { getRecipeRecommendations, RecipesApiError } from '../api/recipesApi';
import { seedRecipes } from '../data/seedRecipes';
import { useIngredients } from './useIngredients';
import { isBackendEnabled } from '../utils/backendConfig';
import { buildRecipeRecommendations } from '../utils/recommendations';

function shouldFallbackToLocalRecommendations(error) {
  return error instanceof RecipesApiError;
}

export function useRecipeRecommendations(pantryOwnership = {}) {
  const { ingredients, loading: ingredientsLoading } = useIngredients();
  const requestIdRef = useRef(0);
  const localRecommendations = useMemo(
    () => buildRecipeRecommendations(seedRecipes, ingredients),
    [ingredients]
  );
  const [recommendations, setRecommendations] = useState(localRecommendations);
  const [loading, setLoading] = useState(ingredientsLoading);
  const [error, setError] = useState('');
  const [dataSource, setDataSource] = useState(isBackendEnabled() ? 'api' : 'local');

  useEffect(() => {
    setRecommendations(localRecommendations);

    if (!isBackendEnabled()) {
      setLoading(ingredientsLoading);
      setError('');
      setDataSource('local');
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    let isMounted = true;

    const loadRecommendations = async () => {
      setLoading(true);

      try {
        const nextRecommendations = await getRecipeRecommendations(ingredients);

        if (!isMounted || requestIdRef.current !== requestId) {
          return;
        }

        setRecommendations(nextRecommendations);
        setError('');
        setDataSource('api');
      } catch (nextError) {
        if (!isMounted || requestIdRef.current !== requestId) {
          return;
        }

        if (!shouldFallbackToLocalRecommendations(nextError)) {
          setError(nextError.message || '추천 결과를 불러오지 못했어요.');
          setRecommendations(localRecommendations);
          setDataSource('local');
          return;
        }

        console.warn('[useRecipeRecommendations] Failed to load via API. Falling back to local recommendations.', nextError);
        setRecommendations(localRecommendations);
        setError('추천 API 연결이 불안정해서 브라우저 기준 추천을 보여주고 있어요.');
        setDataSource('local');
      } finally {
        if (isMounted && requestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    };

    loadRecommendations();

    return () => {
      isMounted = false;
    };
  }, [ingredients, ingredientsLoading, localRecommendations, pantryOwnership]);

  return {
    recommendations,
    loading,
    error,
    dataSource,
    ingredients
  };
}
