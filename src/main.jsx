import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import App from './App';
import { AnalyticsProvider } from './hooks/useAnalytics';
import { AuthProvider } from './hooks/useAuth';
import { IngredientsProvider } from './hooks/useIngredients';
import { PantryStaplesProvider } from './hooks/usePantryStaples';
import { MenuDecisionProvider } from './hooks/useMenuDecision';
import { UserPreferencesProvider } from './hooks/useUserPreferences';
import { createSentryPrivacyOptions } from './utils/sentryPrivacy';
import './index.css';

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    ...createSentryPrivacyOptions({ origin: globalThis.location.origin }),
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AnalyticsProvider>
          <PantryStaplesProvider>
            <UserPreferencesProvider>
              <MenuDecisionProvider>
                <IngredientsProvider>
                  <App />
                </IngredientsProvider>
              </MenuDecisionProvider>
            </UserPreferencesProvider>
          </PantryStaplesProvider>
        </AnalyticsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
