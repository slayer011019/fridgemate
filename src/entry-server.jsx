import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import App from './App';
import { AnalyticsProvider } from './hooks/useAnalytics';
import { AuthProvider } from './hooks/useAuth';
import { IngredientsProvider } from './hooks/useIngredients';
import { PantryStaplesProvider } from './hooks/usePantryStaples';

export function render(pathname) {
  return renderToStaticMarkup(
    <StaticRouter location={pathname}>
      <AuthProvider>
        <AnalyticsProvider>
          <PantryStaplesProvider>
            <IngredientsProvider>
              <App />
            </IngredientsProvider>
          </PantryStaplesProvider>
        </AnalyticsProvider>
      </AuthProvider>
    </StaticRouter>
  );
}
