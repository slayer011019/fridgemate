import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { saveRecommendationEvent } from '../api/recommendationEventsApi';
import {
  isRetryableMenuDecisionError,
  loadLocalMenuDecision,
  loadServerMenuDecision,
  removeLocalMenuDecision,
  saveLocalMenuDecision,
  saveServerMenuDecision
} from '../features/menuDecisions/menuDecisionRepository';
import {
  buildMenuDecision,
  getKoreanDate,
  mergeMenuDecision,
  updateMenuDecisionStatus
} from '../features/menuDecisions/menuDecisionDomain';
import { getRecipeKey } from '../features/recipes/recipeIdentity';
import { GUEST_STORAGE_SCOPE } from '../features/auth/authStorage';
import { isBackendEnabled } from '../utils/backendConfig';
import { useAuth } from './useAuth';

const MenuDecisionContext = createContext(null);

function dismissedStorageKey(scope, date) {
  return `fridgemate-dismissed-recipes:v1:${scope}:${date}`;
}

function loadDismissed(scope, date) {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(dismissedStorageKey(scope, date)) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function MenuDecisionProvider({ children }) {
  const { isAuthenticated, storageScope } = useAuth();
  const backendEnabled = isBackendEnabled() && isAuthenticated;
  const decisionDate = getKoreanDate();
  const [decision, setDecision] = useState(null);
  const [dismissedRecipeKeys, setDismissedRecipeKeys] = useState(() => loadDismissed(storageScope, decisionDate));
  const [guestDecisionAvailable, setGuestDecisionAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  const persistDecision = useCallback(
    async (nextDecision) => {
      await saveLocalMenuDecision(nextDecision, storageScope);
      setDecision(nextDecision);
    },
    [storageScope]
  );

  const syncDecision = useCallback(
    async (nextDecision) => {
      if (!backendEnabled) {
        const localDecision = { ...nextDecision, syncState: 'local' };
        await persistDecision(localDecision);
        return localDecision;
      }

      setSyncing(true);
      setError('');
      try {
        const saved = await saveServerMenuDecision(decisionDate, nextDecision);
        const clean = { ...saved, syncState: 'clean' };
        await persistDecision(clean);
        return clean;
      } catch (nextError) {
        const failed = {
          ...nextDecision,
          syncState: isRetryableMenuDecisionError(nextError) ? 'pending' : 'error'
        };
        await persistDecision(failed);
        setError(nextError.message || '오늘 메뉴를 서버에 저장하지 못했습니다.');
        return failed;
      } finally {
        setSyncing(false);
      }
    },
    [backendEnabled, decisionDate, persistDecision]
  );

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');
    setDismissedRecipeKeys(loadDismissed(storageScope, decisionDate));

    Promise.all([
      loadLocalMenuDecision(decisionDate, storageScope),
      backendEnabled ? loadServerMenuDecision(decisionDate).catch(() => null) : Promise.resolve(null),
      isAuthenticated ? loadLocalMenuDecision(decisionDate, GUEST_STORAGE_SCOPE) : Promise.resolve(null)
    ]).then(async ([localDecision, serverDecision, guestDecision]) => {
      if (!mounted) return;
      const merged = mergeMenuDecision(localDecision, serverDecision);
      if (merged && merged !== localDecision) await saveLocalMenuDecision(merged, storageScope);
      if (!mounted) return;
      setDecision(merged);
      setGuestDecisionAvailable(Boolean(guestDecision && guestDecision.status !== 'cancelled'));
      setLoading(false);
    }).catch((nextError) => {
      if (!mounted) return;
      setError(nextError.message || '오늘 메뉴를 불러오지 못했습니다.');
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [backendEnabled, decisionDate, isAuthenticated, storageScope]);

  const selectMenu = useCallback(
    async (recipe, options = {}) => {
      const nextDecision = buildMenuDecision(recipe, decision);
      await persistDecision({ ...nextDecision, syncState: backendEnabled ? 'pending' : 'local' });
      saveRecommendationEvent(recipe, 'select', {
        group: options.group,
        screen: options.screen,
        source: recipe._recommendationSource
      }).catch(() => {});
      return syncDecision(nextDecision);
    },
    [backendEnabled, decision, persistDecision, syncDecision]
  );

  const changeStatus = useCallback(
    async (status) => {
      if (!decision) return null;
      const nextDecision = updateMenuDecisionStatus(decision, status);
      await persistDecision({ ...nextDecision, syncState: backendEnabled ? 'pending' : 'local' });
      saveRecommendationEvent(
        { id: decision.recipeKey, title: decision.recipeName, _recommendationSource: decision.recommendationSource },
        status === 'completed' ? 'complete' : 'dismiss',
        { screen: 'home', source: decision.recommendationSource }
      ).catch(() => {});
      return syncDecision(nextDecision);
    },
    [backendEnabled, decision, persistDecision, syncDecision]
  );

  const dismissRecipe = useCallback(
    (recipe, options = {}) => {
      const recipeKey = getRecipeKey(recipe);
      if (!recipeKey) return;
      setDismissedRecipeKeys((current) => {
        const next = [...new Set([...current, recipeKey])];
        window.localStorage.setItem(dismissedStorageKey(storageScope, decisionDate), JSON.stringify(next));
        return next;
      });
      saveRecommendationEvent(recipe, 'dismiss', {
        group: options.group,
        screen: options.screen,
        source: recipe._recommendationSource
      }).catch(() => {});
    },
    [decisionDate, storageScope]
  );

  const recordExternalOpen = useCallback((recipe, options = {}) => {
    saveRecommendationEvent(recipe, 'external_open', {
      group: options.group,
      screen: options.screen,
      source: recipe._recommendationSource
    }).catch(() => {});
  }, []);

  const retrySync = useCallback(() => decision && syncDecision(decision), [decision, syncDecision]);

  const importGuestDecision = useCallback(async () => {
    const guestDecision = await loadLocalMenuDecision(decisionDate, GUEST_STORAGE_SCOPE);
    if (!guestDecision) return null;
    const imported = {
      ...guestDecision,
      clientId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${guestDecision.clientId}-imported`,
      syncState: 'pending',
      updatedAt: new Date().toISOString()
    };
    await persistDecision(imported);
    const saved = await syncDecision(imported);
    if (saved.syncState === 'clean') {
      await removeLocalMenuDecision(decisionDate, GUEST_STORAGE_SCOPE);
      setGuestDecisionAvailable(false);
    }
    return saved;
  }, [decisionDate, persistDecision, syncDecision]);

  const value = useMemo(() => ({
    decision,
    decisionDate,
    dismissedRecipeKeys,
    error,
    guestDecisionAvailable,
    loading,
    syncing,
    cancelMenu: () => changeStatus('cancelled'),
    completeMenu: () => changeStatus('completed'),
    dismissRecipe,
    importGuestDecision,
    recordExternalOpen,
    retrySync,
    selectMenu
  }), [
    changeStatus,
    decision,
    decisionDate,
    dismissedRecipeKeys,
    dismissRecipe,
    error,
    guestDecisionAvailable,
    importGuestDecision,
    loading,
    recordExternalOpen,
    retrySync,
    selectMenu,
    syncing
  ]);

  return createElement(MenuDecisionContext.Provider, { value }, children);
}

export function useMenuDecision() {
  const context = useContext(MenuDecisionContext);
  if (!context) throw new Error('useMenuDecision must be used within MenuDecisionProvider.');
  return context;
}
