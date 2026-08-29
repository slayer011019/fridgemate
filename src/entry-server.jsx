import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import AppServer from './AppServer';
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
              <AppServer />
            </IngredientsProvider>
          </PantryStaplesProvider>
        </AnalyticsProvider>
      </AuthProvider>
    </StaticRouter>
  );
}
