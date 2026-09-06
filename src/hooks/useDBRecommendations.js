import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getRecipeRecommendations,
  getSemanticRecipeRecommendations,
  RecipesApiError
} from '../api/recipesApi';
import { useAuth } from './useAuth';
import { isBackendEnabled } from '../utils/backendConfig';
import { useOptionalUserPreferences } from './useUserPreferences';

function shouldHideRow(error) {
  return error instanceof RecipesApiError && (!error.status || error.status >= 500);
}

export function useDBRecommendations({ ingredients = [], pantryItems = [] } = {}) {
  const { isAuthenticated } = useAuth();
  const { preferences } = useOptionalUserPreferences();
  const [rowElement, setRowElement] = useState(null);
  const rowRef = useCallback((element) => { setRowElement(element); }, []);
  const requestIdRef = useRef(0);
  const [hasEnteredViewport, setHasEnteredViewport] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hidden, setHidden] = useState(false);
  const [mode, setMode] = useState('rule');

  useEffect(() => {
    if (hasEnteredViewport || !isAuthenticated || !isBackendEnabled() || hidden) {
      return undefined;
    }

    const target = rowElement;

    if (!target) {
      return undefined;
    }

    if (typeof IntersectionObserver === 'undefined') {
      setHidden(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setHasEnteredViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: '160px 0px' }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [hasEnteredViewport, hidden, isAuthenticated, rowElement]);

  useEffect(() => {
    if (!isAuthenticated) {
      setRecommendations([]);
      setLoading(false);
      setError('');
      setHidden(false);
      return undefined;
    }

    if (!isBackendEnabled()) {
      setHidden(true);
      setLoading(false);
      setError('');
      return undefined;
    }

    if (!hasEnteredViewport) {
      return undefined;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    let isMounted = true;

    const loadRecommendations = async () => {
      setLoading(true);
      setError('');
      setHidden(false);

      try {
        const nextRecommendations = await getRecipeRecommendations(ingredients, pantryItems, preferences);

        if (!isMounted || requestIdRef.current !== requestId) {
          return;
        }

        setRecommendations(Array.isArray(nextRecommendations) ? nextRecommendations : []);
        setMode('rule');
        setError('');
        setHidden(false);
      } catch (nextError) {
        if (!isMounted || requestIdRef.current !== requestId) {
          return;
        }

        setRecommendations([]);

        if (shouldHideRow(nextError)) {
          setHidden(true);
          setError('');
          return;
        }

        setHidden(false);
        setError(nextError.message || '추천을 불러오지 못했어요.');
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
  }, [hasEnteredViewport, ingredients, isAuthenticated, pantryItems, preferences]);

  const requestExternalAiRecommendations = useCallback(async () => {
    if (!isAuthenticated || !isBackendEnabled()) return null;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError('');
    setHidden(false);

    try {
      const payload = await getSemanticRecipeRecommendations(
        ingredients,
        pantryItems,
        preferences,
        { userInitiated: true }
      );

      if (requestIdRef.current !== requestId) return payload;

      setRecommendations(Array.isArray(payload?.recommendations) ? payload.recommendations : []);
      setMode(payload?.mode === 'semantic' ? 'semantic' : 'rule-fallback');
      return payload;
    } catch (nextError) {
      if (requestIdRef.current === requestId) {
        setError(nextError.message || '외부 AI 추천을 불러오지 못했어요.');
      }
      return null;
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [ingredients, isAuthenticated, pantryItems, preferences]);

  return {
    rowRef,
    recommendations,
    loading,
    error,
    hidden,
    mode,
    needsLogin: !isAuthenticated,
    hasEnteredViewport,
    requestExternalAiRecommendations
  };
}
