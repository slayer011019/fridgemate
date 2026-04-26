import Header from './Header';
import ConnectionStatusToast from './ConnectionStatusToast';

function AppShell({ children }) {
  return (
    <div className="min-h-screen">
      <Header />
      <ConnectionStatusToast />
      <main className="app-frame">
        {children}
      </main>
    </div>
  );
}

export default AppShell;
