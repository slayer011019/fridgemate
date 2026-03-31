import Header from './Header';

function AppShell({ children }) {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

export default AppShell;
