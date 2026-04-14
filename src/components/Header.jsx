import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isOcrEnabled } from '../utils/backendConfig';

const navItems = [
  { label: '\uD648', to: '/', match: (pathname) => pathname === '/' },
  {
    label: '\uB0C9\uC7A5\uACE0 \uBCF4\uAE30',
    to: '/ingredients',
    match: (pathname) => pathname === '/ingredients' || /^\/ingredients\/[^/]+\/edit$/.test(pathname)
  },
  { label: '\uC9C1\uC811 \uC785\uB825', to: '/ingredients/new', match: (pathname) => pathname === '/ingredients/new' },
  { label: '\uC0AC\uC9C4\uC73C\uB85C \uB4F1\uB85D', to: '/import', match: (pathname) => pathname.startsWith('/import') },
  { label: '\uBA54\uB274 \uCD94\uCC9C', to: '/recipes', match: (pathname) => pathname.startsWith('/recipes') }
];

function Header() {
  const location = useLocation();
  const ocrEnabled = isOcrEnabled();
  const { isAuthenticated, logout, user } = useAuth();
  const visibleNavItems = ocrEnabled ? navItems : navItems.filter((item) => item.to !== '/import');

  return (
    <header className="sticky top-0 z-30 border-b border-white/50 bg-[#fbf8f2]/88 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <p className="kicker">FridgeMate</p>
              <div className="mt-1 space-y-1">
                <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-[1.45rem]">
                  {'\uC2E4\uC6A9\uC801\uC73C\uB85C \uAD00\uB9AC\uD558\uB294 \uB0C9\uC7A5\uACE0 \u0026 \uD32C\uD2B8\uB9AC \uD50C\uB798\uB108'}
                </h1>
                <p className="max-w-2xl text-sm leading-6 muted">
                  {
                    '\uC7AC\uB8CC\uB97C \uC815\uB9AC\uD558\uACE0 \uC720\uD1B5\uAE30\uD55C\uC744 \uD655\uC778\uD558\uBA70, \uC9C0\uAE08 \uB9CC\uB4E4 \uC218 \uC788\uB294 \uBA54\uB274\uAE4C\uC9C0 \uBE60\uB974\uAC8C \uD30C\uC545\uD574\uBCF4\uC138\uC694.'
                  }
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 xl:items-end">
              <nav className="glass-card flex w-full max-w-full items-center gap-1.5 overflow-x-auto p-1.5 xl:w-auto">
                {visibleNavItems.map((item) => {
                  const isActive = item.match(location.pathname);

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold ${
                        isActive
                          ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/20'
                          : 'text-slate-600 hover:bg-white/90 hover:text-slate-900'
                      }`}
                    >
                      {item.label}
                    </NavLink>
                  );
                })}
              </nav>

              <div className="flex flex-wrap items-center gap-2 rounded-full border border-white/70 bg-white/65 px-2 py-2 shadow-sm">
                {isAuthenticated ? (
                  <>
                    <span className="rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600">{user?.email}</span>
                    <NavLink className="btn-secondary px-3.5 py-2" to="/account">
                      {'\uACC4\uC815'}
                    </NavLink>
                    <button className="btn-primary px-3.5 py-2" onClick={logout} type="button">
                      {'\uB85C\uADF8\uC544\uC6C3'}
                    </button>
                  </>
                ) : (
                  <>
                    <NavLink className="btn-secondary px-3.5 py-2" to="/login">
                      {'\uB85C\uADF8\uC778'}
                    </NavLink>
                    <NavLink className="btn-primary px-3.5 py-2" to="/signup">
                      {'\uD68C\uC6D0\uAC00\uC785'}
                    </NavLink>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
