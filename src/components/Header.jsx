import { NavLink, useLocation } from 'react-router-dom';

const navItems = [
  { label: '홈', to: '/', match: (pathname) => pathname === '/' },
  {
    label: '재료 관리',
    to: '/ingredients',
    match: (pathname) => pathname === '/ingredients' || /^\/ingredients\/[^/]+\/edit$/.test(pathname)
  },
  { label: '재료 추가', to: '/ingredients/new', match: (pathname) => pathname === '/ingredients/new' },
  { label: '영수증 불러오기', to: '/import', match: (pathname) => pathname.startsWith('/import') },
  { label: '레시피', to: '/recipes', match: (pathname) => pathname.startsWith('/recipes') }
];

function Header() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-30 border-b border-white/50 bg-[#fbf8f2]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="kicker">FridgeMate</p>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {'혼자 살아도 산뜻하게 쓰는 냉장고 루틴'}
              </h1>
              <p className="mt-1 text-sm muted">
                {'재료 관리, 유통기한 확인, 레시피 찾기를 하나의 흐름으로 연결해보세요.'}
              </p>
            </div>
          </div>

          <div className="glass-card flex w-full max-w-full gap-2 overflow-x-auto p-2 lg:w-auto">
            {navItems.map((item) => {
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
        </div>
      </div>
    </header>
  );
}

export default Header;

