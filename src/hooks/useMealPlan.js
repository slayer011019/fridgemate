import { useCallback, useEffect, useRef, useState } from 'react';
import { confirmMealPlan, getMealPlan, saveMealPlan } from '../features/mealPlans/mealPlanRepository';
import { useAuth } from './useAuth';

function emptyState(key) {
  return { key, record: null, loading: true, saving: false, ready: false, error: '' };
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
  const refreshRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

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
      record: previous.key === key ? previous.record : null
    }));

    getMealPlan(weekStart, storageScope).then((record) => {
      if (active && contextRef.current === context && loadRef.current === request) {
        refreshRef.current = null;
        setState({ key, record, loading: false, saving: false, ready: true, error: '' });
      }
    }).catch((error) => {
      if (active && contextRef.current === context && loadRef.current === request) {
        refreshRef.current = null;
        setState((previous) => ({
          ...previous,
          loading: false,
          error: error?.message || '식단을 불러오지 못했습니다. 저장소를 확인한 뒤 다시 시도해주세요.'
        }));
      }
    });

    return () => { active = false; };
  }, [authLoading, key, loadAttempt, storageScope, weekStart]);

  const persist = useCallback(async (action, nextPlan) => {
    const context = renderedContext;
    if (!mountedRef.current || authLoading || contextRef.current !== context
      || context.key !== key || state.key !== key || state.loading || !state.ready
      || stateRef.current !== state
      || refreshRef.current === context
      || saveRef.current?.context === context) return null;
    if (action === 'confirm' && !state.record?.draft) return null;
    if (action === 'draft' && (nextPlan?.scope !== storageScope || nextPlan?.weekStart !== weekStart)) {
      setState((previous) => ({ ...previous, error: '현재 계정과 선택한 주의 식단인지 확인해주세요.' }));
      return null;
    }

    const operation = { context };
    saveRef.current = operation;
    ++loadRef.current;
    setState((previous) => ({ ...previous, saving: true, error: '' }));

    try {
      const expectedRevision = state.record?.revision ?? 0;
      const record = action === 'confirm'
        ? await confirmMealPlan(weekStart, storageScope, expectedRevision)
        : await saveMealPlan(nextPlan, storageScope, expectedRevision);
      if (mountedRef.current && contextRef.current === context && saveRef.current === operation) {
        setState({ key, record, loading: false, saving: false, ready: true, error: '' });
        return action === 'confirm' ? record.confirmed : record.draft;
      }
      return null;
    } catch (error) {
      if (mountedRef.current && contextRef.current === context && saveRef.current === operation) {
        setState((previous) => ({
          ...previous,
          saving: false,
          error: error?.message || '식단을 저장하지 못했습니다. 기존 초안과 확정 식단을 유지했습니다. 다시 시도해주세요.'
        }));
      }
      return null;
    } finally {
      if (saveRef.current === operation) saveRef.current = null;
    }
  }, [authLoading, key, renderedContext, state, storageScope, weekStart]);

  const savePlan = useCallback((nextPlan) => persist('draft', nextPlan), [persist]);
  const confirmPlan = useCallback(() => persist('confirm'), [persist]);

  const retryLoad = useCallback(() => {
    const context = contextRef.current;
    if (saveRef.current?.context === context) return;
    // Close the write gate synchronously, before React runs the loading effect.
    refreshRef.current = context;
    ++loadRef.current;
    setState((previous) => previous.key === context.key
      ? { ...previous, ready: false, loading: true } : previous);
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  const visibleState = !authLoading && state.key === key ? state : emptyState(key);
  const record = visibleState.record;
  // Display is derived from the committed storage response, never optimistic state.
  return {
    ...visibleState, plan: record?.draft ?? record?.confirmed ?? null,
    confirmedPlan: record?.confirmed ?? null, hasDraft: Boolean(record?.draft),
    recordRevision: record?.revision ?? 0, savePlan, confirmPlan, retryLoad, storageScope,
  };
}
