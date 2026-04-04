import Header from './Header';
import ConnectionStatusToast from './ConnectionStatusToast';

function AppShell({ children }) {
  return (
    <div className="min-h-screen">
      <Header />
      <ConnectionStatusToast />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

export default AppShell;
