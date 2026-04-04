import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isOcrEnabled } from '../utils/backendConfig';

const navItems = [
  { label: 'Home', to: '/', match: (pathname) => pathname === '/' },
  {
    label: 'Ingredients',
    to: '/ingredients',
    match: (pathname) => pathname === '/ingredients' || /^\/ingredients\/[^/]+\/edit$/.test(pathname)
  },
  { label: 'Add ingredient', to: '/ingredients/new', match: (pathname) => pathname === '/ingredients/new' },
  { label: 'Import', to: '/import', match: (pathname) => pathname.startsWith('/import') },
  { label: 'Recipes', to: '/recipes', match: (pathname) => pathname.startsWith('/recipes') }
];

function Header() {
  const location = useLocation();
  const ocrEnabled = isOcrEnabled();
  const { isAuthenticated, logout, user } = useAuth();
  const visibleNavItems = ocrEnabled ? navItems : navItems.filter((item) => item.to !== '/import');

  return (
    <header className="sticky top-0 z-30 border-b border-white/50 bg-[#fbf8f2]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="kicker">FridgeMate</p>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">A practical fridge and pantry tracker</h1>
              <p className="mt-1 text-sm muted">Track ingredients, spot expiry risks, and plan what to cook next.</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <div className="glass-card flex w-full max-w-full gap-2 overflow-x-auto p-2 lg:w-auto">
              {visibleNavItems.map((item) => {
                const isActive = item.match(location.pathname);

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                      isActive
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'bg-white/70 text-slate-600 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </NavLink>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              {isAuthenticated ? (
                <>
                  <span className="rounded-full bg-white/70 px-3 py-2 text-slate-600">{user?.email}</span>
                  <NavLink className="btn-secondary" to="/account">
                    Account
                  </NavLink>
                  <button className="btn-primary" onClick={logout} type="button">
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <NavLink className="btn-secondary" to="/login">
                    Log in
                  </NavLink>
                  <NavLink className="btn-primary" to="/signup">
                    Sign up
                  </NavLink>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
