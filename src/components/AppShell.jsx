import Header from './Header';
import ConnectionStatusToast from './ConnectionStatusToast';
import SiteFooter from './SiteFooter';
import AnalyticsConsentBanner from './AnalyticsConsentBanner';
import MealPlanPilotNotice from './MealPlanPilotNotice';

function AppShell({ children }) {
  return (
    <div className="min-h-screen">
      <Header />
      <ConnectionStatusToast />
      <main className="app-frame">
        <MealPlanPilotNotice />
        {children}
      </main>
      <SiteFooter />
      <AnalyticsConsentBanner />
    </div>
  );
}

export default AppShell;
