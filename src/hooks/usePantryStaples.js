import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { PANTRY_STATUS, PANTRY_STATUS_ORDER, pantryStaples } from '../data/pantryStaples';
import { getPantryOwnership, savePantryOwnership } from '../api/personalizationApi';
import { useAuth } from './useAuth';

const LEGACY_STORAGE_KEY = 'fridgemate-pantry-ownership';
const PantryStaplesContext = createContext(null);

function storageKey(scope) {
  return `fridgemate-pantry-ownership:v2:${scope}`;
}

function getInitialPantryOwnership(scope = 'guest') {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const scopedValue = window.localStorage.getItem(storageKey(scope));
    const legacyValue = scope === 'guest' ? window.localStorage.getItem(LEGACY_STORAGE_KEY) : null;
    const parsed = JSON.parse(scopedValue || legacyValue || '{}');

    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return parsed;
  } catch {
    return {};
  }
}

function getNextStatus(currentStatus) {
  const currentIndex = PANTRY_STATUS_ORDER.indexOf(currentStatus);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % PANTRY_STATUS_ORDER.length;
  return PANTRY_STATUS_ORDER[nextIndex];
}

export function PantryStaplesProvider({ children }) {
  const { isAuthenticated, storageScope } = useAuth();
  const [pantryOwnership, setPantryOwnership] = useState(() => getInitialPantryOwnership(storageScope));
  const [syncError, setSyncError] = useState('');

  const persistPantryOwnership = useCallback((updater) => {
    setPantryOwnership((current) => {
      const nextOwnership = typeof updater === 'function' ? updater(current) : updater;

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey(storageScope), JSON.stringify(nextOwnership));
      }

      return nextOwnership;
    });
  }, [storageScope]);

  useEffect(() => {
    let mounted = true;
    const local = getInitialPantryOwnership(storageScope);
    queueMicrotask(() => {
      if (!mounted) return;
      setPantryOwnership(local);
      setSyncError('');
    });

    if (!isAuthenticated) return undefined;

    getPantryOwnership()
      .then((items) => {
        if (!mounted || !Array.isArray(items)) return;
        const remote = Object.fromEntries(items.map((item) => [item.stapleId, item.status]));
        const merged = { ...local, ...remote };
        window.localStorage.setItem(storageKey(storageScope), JSON.stringify(merged));
        setPantryOwnership(merged);
      })
      .catch(() => {
        if (mounted) setSyncError('팬트리 서버 상태를 불러오지 못해 이 기기의 설정을 사용합니다.');
      });

    return () => { mounted = false; };
  }, [isAuthenticated, storageScope]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleStorage = (event) => {
      if (event.key !== storageKey(storageScope)) {
        return;
      }

      setPantryOwnership(getInitialPantryOwnership(storageScope));
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [storageScope]);

  const setPantryStatus = useCallback(
    (id, status) => {
      const nextStatus = Object.values(PANTRY_STATUS).includes(status) ? status : PANTRY_STATUS.UNKNOWN;
      persistPantryOwnership((current) => {
        const next = { ...current, [id]: nextStatus };
        if (isAuthenticated) {
          savePantryOwnership([{ stapleId: id, status: nextStatus }])
            .then(() => setSyncError(''))
            .catch(() => setSyncError('서버 저장에 실패했지만 이 기기의 팬트리 설정은 유지됩니다.'));
        }
        return next;
      });
    },
    [isAuthenticated, persistPantryOwnership]
  );

  const cyclePantryStatus = useCallback(
    (id) =>
      persistPantryOwnership((current) => {
        const currentStatus = current[id] || PANTRY_STATUS.UNKNOWN;
        const nextStatus = getNextStatus(currentStatus);

        if (isAuthenticated) {
          savePantryOwnership([{ stapleId: id, status: nextStatus }])
            .then(() => setSyncError(''))
            .catch(() => setSyncError('서버 저장에 실패했지만 이 기기의 팬트리 설정은 유지됩니다.'));
        }

        return {
          ...current,
          [id]: nextStatus
        };
      }),
    [isAuthenticated, persistPantryOwnership]
  );

  const pantrySummary = useMemo(() => {
    const summary = {
      owned: 0,
      missing: 0,
      unknown: 0
    };

    pantryStaples.forEach((staple) => {
      const status = pantryOwnership[staple.id] || PANTRY_STATUS.UNKNOWN;
      summary[status] += 1;
    });

    return summary;
  }, [pantryOwnership]);

  const value = useMemo(
    () => ({
      pantryStaples,
      pantryOwnership,
      pantrySummary,
      syncError,
      setPantryStatus,
      cyclePantryStatus
    }),
    [cyclePantryStatus, pantryOwnership, pantrySummary, setPantryStatus, syncError]
  );

  return createElement(PantryStaplesContext.Provider, { value }, children);
}

export function usePantryStaples() {
  const context = useContext(PantryStaplesContext);

  if (!context) {
    throw new Error('usePantryStaples must be used within PantryStaplesProvider.');
  }

  return context;
}
