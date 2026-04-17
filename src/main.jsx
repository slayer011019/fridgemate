import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AnalyticsProvider } from './hooks/useAnalytics';
import { AuthProvider } from './hooks/useAuth';
import { IngredientsProvider } from './hooks/useIngredients';
import { PantryStaplesProvider } from './hooks/usePantryStaples';
import './index.css';

// Optional Sentry setup goes here before React mounts.
// 1. Install: npm install @sentry/react
// 2. Add: import * as Sentry from '@sentry/react';
// 3. Initialize only when VITE_SENTRY_DSN is set:
//    if (import.meta.env.VITE_SENTRY_DSN) {
//      Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN });
//    }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AnalyticsProvider>
          <PantryStaplesProvider>
            <IngredientsProvider>
              <App />
            </IngredientsProvider>
          </PantryStaplesProvider>
        </AnalyticsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
