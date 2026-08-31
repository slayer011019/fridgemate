import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getUserPreferences, saveUserPreferences } from '../api/personalizationApi';
import { useAuth } from './useAuth';

const DEFAULT_PREFERENCES = {
  preferredIngredients: [],
  dislikedIngredients: [],
  spiceLevel: 'medium',
  cookingTimePreference: 'flexible'
};
const UserPreferencesContext = createContext(null);

function key(scope) {
  return `fridgemate-user-preferences:v1:${scope}`;
}

function loadLocal(scope) {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key(scope)) || '{}');
    return { ...DEFAULT_PREFERENCES, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function UserPreferencesProvider({ children }) {
  const { isAuthenticated, storageScope } = useAuth();
  const [preferences, setPreferences] = useState(() => loadLocal(storageScope));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const local = loadLocal(storageScope);
    setPreferences(local);
    setError('');
    if (!isAuthenticated) return undefined;

    getUserPreferences()
      .then((remote) => {
        if (!mounted || !remote) return;
        const next = { ...DEFAULT_PREFERENCES, ...remote };
        window.localStorage.setItem(key(storageScope), JSON.stringify(next));
        setPreferences(next);
      })
      .catch(() => {
        if (mounted) setError('취향 설정을 불러오지 못해 이 기기의 설정을 사용합니다.');
      });
    return () => { mounted = false; };
  }, [isAuthenticated, storageScope]);

  const savePreferences = useCallback(async (nextPreferences) => {
    const next = { ...DEFAULT_PREFERENCES, ...nextPreferences };
    window.localStorage.setItem(key(storageScope), JSON.stringify(next));
    setPreferences(next);
    setError('');
    if (!isAuthenticated) return next;

    setSaving(true);
    try {
      const saved = await saveUserPreferences(next);
      const normalized = { ...DEFAULT_PREFERENCES, ...saved };
      window.localStorage.setItem(key(storageScope), JSON.stringify(normalized));
      setPreferences(normalized);
      return normalized;
    } catch (nextError) {
      setError(nextError.message || '취향 설정을 서버에 저장하지 못했습니다.');
      throw nextError;
    } finally {
      setSaving(false);
    }
  }, [isAuthenticated, storageScope]);

  const value = useMemo(() => ({ error, preferences, savePreferences, saving }), [error, preferences, savePreferences, saving]);
  return createElement(UserPreferencesContext.Provider, { value }, children);
}

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);
  if (!context) throw new Error('useUserPreferences must be used within UserPreferencesProvider.');
  return context;
}

export function useOptionalUserPreferences() {
  const context = useContext(UserPreferencesContext);
  return context || { preferences: DEFAULT_PREFERENCES };
}
