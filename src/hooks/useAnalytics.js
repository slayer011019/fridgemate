import { createContext, createElement, useCallback, useContext, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { ingredientCache } from '../features/ingredients/ingredientRepository';
import { useAuth } from './useAuth';
import {
  buildAnalyticsPayload,
  hasTrackedSessionStarted,
  markSessionStartedTracked,
  recordAnalyticsEvent
} from '../utils/analytics';

const AnalyticsContext = createContext({
  trackEvent: () => null
});

export function AnalyticsProvider({ children }) {
  const location = useLocation();
  const { isAuthenticated, loading, storageScope, user } = useAuth();

  const trackEvent = useCallback(
    (eventName, properties = {}) => {
      const payload = buildAnalyticsPayload({
        eventName,
        route: location.pathname,
        isAuthenticated,
        userId: user?.id,
        properties
      });

      return recordAnalyticsEvent(payload);
    },
    [isAuthenticated, location.pathname, user?.id]
  );

  useEffect(() => {
    if (loading) return;

    trackEvent('page_view', {
      page_path: `${location.pathname}${location.search}`,
      page_title: typeof document === 'undefined' ? '' : document.title
    });
  }, [loading, location.pathname, location.search, trackEvent]);

  useEffect(() => {
    if (loading || hasTrackedSessionStarted()) {
      return;
    }

    let isMounted = true;
    markSessionStartedTracked();

    ingredientCache
      .getAll({ scope: storageScope })
      .then((items) => {
        if (!isMounted) {
          return;
        }

        trackEvent('session_started', {
          entry_route: location.pathname,
          has_existing_local_data: Array.isArray(items) && items.length > 0,
          has_restored_session: isAuthenticated
        });
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        trackEvent('session_started', {
          entry_route: location.pathname,
          has_existing_local_data: false,
          has_restored_session: isAuthenticated
        });
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, loading, location.pathname, storageScope, trackEvent]);

  const value = useMemo(
    () => ({
      trackEvent
    }),
    [trackEvent]
  );

  return createElement(AnalyticsContext.Provider, { value }, children);
}

export function useAnalytics() {
  return useContext(AnalyticsContext);
}
