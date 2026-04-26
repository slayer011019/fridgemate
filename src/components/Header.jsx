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
    <header className="sticky top-0 z-30 border-b border-white/60 bg-[#fbf8f2]/90 backdrop-blur-xl">
      <div className="app-header-frame">
        <div className="flex flex-col gap-3 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="kicker">FridgeMate</p>
              <h1 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 sm:text-[1.25rem]">
                {'\uB0C9\uC7A5\uACE0 \uC815\uB9AC\uB97C \uBE60\uB974\uAC8C, \uC694\uB9AC \uC120\uD0DD\uC740 \uB354 \uC26C\uAC8C'}
              </h1>
              <p className="max-w-2xl text-sm leading-5.5 muted">
                {'\uC7AC\uB8CC \uD604\uD669, \uC720\uD1B5\uAE30\uD55C, \uC7A5\uBCF4\uAE30 \uD544\uC694\uD55C \uD56D\uBAA9\uC744 \uD55C \uACF3\uC5D0\uC11C \uBCF4\uC138\uC694.'}
              </p>
            </div>

            <div className="flex w-full flex-wrap items-center justify-end gap-2 rounded-full border border-white/75 bg-white/72 px-2 py-2 shadow-sm lg:w-auto">
              {isAuthenticated ? (
                <>
                  <span className="max-w-full truncate rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 sm:max-w-[18rem]">
                    {user?.email}
                  </span>
                  <NavLink className="btn-secondary min-h-[2.25rem] px-3 py-2" to="/account">
                    {'\uACC4\uC815'}
                  </NavLink>
                  <button className="btn-primary min-h-[2.25rem] px-3 py-2" onClick={logout} type="button">
                    {'\uB85C\uADF8\uC544\uC6C3'}
                  </button>
                </>
              ) : (
                <>
                  <NavLink className="btn-secondary min-h-[2.25rem] px-3 py-2" to="/login">
                    {'\uB85C\uADF8\uC778'}
                  </NavLink>
                  <NavLink className="btn-primary min-h-[2.25rem] px-3 py-2" to="/signup">
                    {'\uD68C\uC6D0\uAC00\uC785'}
                  </NavLink>
                </>
              )}
            </div>
          </div>

          <nav className="glass-card touch-pan-x flex w-full max-w-full items-center gap-1.5 overflow-x-auto p-1.5">
            {visibleNavItems.map((item) => {
              const isActive = item.match(location.pathname);

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/20'
                      : 'text-slate-600 hover:bg-white/95 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}

export default Header;
