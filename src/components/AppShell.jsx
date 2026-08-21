import Header from './Header';
import ConnectionStatusToast from './ConnectionStatusToast';
import SiteFooter from './SiteFooter';

function AppShell({ children }) {
  return (
    <div className="min-h-screen">
      <Header />
      <ConnectionStatusToast />
      <main className="app-frame">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

export default AppShell;
