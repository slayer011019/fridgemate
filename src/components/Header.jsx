import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isOcrEnabled } from '../utils/backendConfig';

const navItems = [
  { label: '홈', to: '/', match: (pathname) => pathname === '/' },
  {
    label: '재료 관리',
    to: '/ingredients',
    match: (pathname) => pathname === '/ingredients' || /^\/ingredients\/[^/]+\/edit$/.test(pathname)
  },
  { label: '재료 추가', to: '/ingredients/new', match: (pathname) => pathname === '/ingredients/new' },
  { label: '가져오기', to: '/import', match: (pathname) => pathname.startsWith('/import') },
  { label: '레시피', to: '/recipes', match: (pathname) => pathname.startsWith('/recipes') }
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
                  실용적으로 관리하는 냉장고 · 팬트리 트래커
                </h1>
                <p className="max-w-2xl text-sm leading-6 muted">
                  재료를 정리하고 유통기한을 확인한 뒤, 지금 만들 수 있는 메뉴까지 빠르게 살펴보세요.
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
                      계정
                    </NavLink>
                    <button className="btn-primary px-3.5 py-2" onClick={logout} type="button">
                      로그아웃
                    </button>
                  </>
                ) : (
                  <>
                    <NavLink className="btn-secondary px-3.5 py-2" to="/login">
                      로그인
                    </NavLink>
                    <NavLink className="btn-primary px-3.5 py-2" to="/signup">
                      회원가입
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
