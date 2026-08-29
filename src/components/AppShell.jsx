import Header from './Header';
import ConnectionStatusToast from './ConnectionStatusToast';
import SiteFooter from './SiteFooter';
import AnalyticsConsentBanner from './AnalyticsConsentBanner';

function AppShell({ children }) {
  return (
    <div className="min-h-screen">
      <Header />
      <ConnectionStatusToast />
      <main className="app-frame">
        {children}
      </main>
      <SiteFooter />
      <AnalyticsConsentBanner />
    </div>
  );
}

export default AppShell;
