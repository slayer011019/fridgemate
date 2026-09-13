import { useCallback, useEffect, useRef, useState } from 'react';
import { getMealPlan, saveMealPlan } from '../features/mealPlans/mealPlanRepository';
import { useAuth } from './useAuth';

function emptyState(key) {
  return { key, plan: null, loading: true, saving: false, ready: false, error: '' };
}

export function useMealPlan(weekStart) {
  const { storageScope = 'guest', loading: authLoading = false } = useAuth();
  const key = `${storageScope}|${weekStart}`;
  const [state, setState] = useState(() => emptyState(key));
  const [loadAttempt, setLoadAttempt] = useState(0);
  const contextRef = useRef({ key, authLoading });
  const loadRef = useRef(0);
  const saveRef = useRef(null);
  const mountedRef = useRef(false);

  // Tag results during render, not only after effects, so old account data is never briefly exposed.
  if (contextRef.current.key !== key || contextRef.current.authLoading !== authLoading) {
    contextRef.current = { key, authLoading };
  }
  const renderedContext = contextRef.current;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const context = contextRef.current;
    const request = ++loadRef.current;
    let active = true;
    if (authLoading) return () => { active = false; };

    setState((previous) => ({
      ...emptyState(key),
      plan: previous.key === key ? previous.plan : null
    }));

    getMealPlan(weekStart, storageScope).then((plan) => {
      if (active && contextRef.current === context && loadRef.current === request) {
        setState({ key, plan, loading: false, saving: false, ready: true, error: '' });
      }
    }).catch((error) => {
      if (active && contextRef.current === context && loadRef.current === request) {
        setState((previous) => ({
          ...previous,
          loading: false,
          error: error?.message || '식단을 불러오지 못했습니다. 저장소를 확인한 뒤 다시 시도해주세요.'
        }));
      }
    });

    return () => { active = false; };
  }, [authLoading, key, loadAttempt, storageScope, weekStart]);

  const savePlan = useCallback(async (nextPlan) => {
    const context = renderedContext;
    if (!mountedRef.current || authLoading || contextRef.current !== context
      || context.key !== key || state.key !== key || state.loading || !state.ready
      || saveRef.current?.context === context) return null;
    if (nextPlan?.scope !== storageScope || nextPlan?.weekStart !== weekStart) {
      setState((previous) => ({ ...previous, error: '현재 계정과 선택한 주의 식단인지 확인해주세요.' }));
      return null;
    }

    const operation = { context };
    saveRef.current = operation;
    ++loadRef.current;
    setState((previous) => ({ ...previous, saving: true, error: '' }));

    try {
      const plan = await saveMealPlan(nextPlan, storageScope);
      if (mountedRef.current && contextRef.current === context && saveRef.current === operation) {
        setState({ key, plan, loading: false, saving: false, ready: true, error: '' });
        return plan;
      }
      return null;
    } catch (error) {
      if (mountedRef.current && contextRef.current === context && saveRef.current === operation) {
        setState((previous) => ({
          ...previous,
          saving: false,
          error: error?.message || '식단을 저장하지 못했습니다. 이전 식단을 유지했습니다. 다시 시도해주세요.'
        }));
      }
      return null;
    } finally {
      if (saveRef.current === operation) saveRef.current = null;
    }
  }, [authLoading, key, renderedContext, state.key, state.loading, state.ready, storageScope, weekStart]);

  const retryLoad = useCallback(() => {
    if (saveRef.current?.context !== contextRef.current) setLoadAttempt((attempt) => attempt + 1);
  }, []);

  const visibleState = !authLoading && state.key === key ? state : emptyState(key);
  return { ...visibleState, savePlan, retryLoad, storageScope };
}
