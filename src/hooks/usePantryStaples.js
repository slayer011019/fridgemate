import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { PANTRY_STATUS, PANTRY_STATUS_ORDER, pantryStaples } from '../data/pantryStaples';

const STORAGE_KEY = 'fridgemate-pantry-ownership';
const PantryStaplesContext = createContext(null);

function getInitialPantryOwnership() {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');

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
  const [pantryOwnership, setPantryOwnership] = useState(getInitialPantryOwnership);

  const persistPantryOwnership = useCallback((updater) => {
    setPantryOwnership((current) => {
      const nextOwnership = typeof updater === 'function' ? updater(current) : updater;

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextOwnership));
      }

      return nextOwnership;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleStorage = (event) => {
      if (event.key !== STORAGE_KEY) {
        return;
      }

      setPantryOwnership(getInitialPantryOwnership());
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setPantryStatus = useCallback(
    (id, status) => {
      const nextStatus = Object.values(PANTRY_STATUS).includes(status) ? status : PANTRY_STATUS.UNKNOWN;
      persistPantryOwnership((current) => ({
        ...current,
        [id]: nextStatus
      }));
    },
    [persistPantryOwnership]
  );

  const cyclePantryStatus = useCallback(
    (id) =>
      persistPantryOwnership((current) => {
        const currentStatus = current[id] || PANTRY_STATUS.UNKNOWN;

        return {
          ...current,
          [id]: getNextStatus(currentStatus)
        };
      }),
    [persistPantryOwnership]
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
      setPantryStatus,
      cyclePantryStatus
    }),
    [cyclePantryStatus, pantryOwnership, pantrySummary, setPantryStatus]
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
