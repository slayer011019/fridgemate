import { NavLink } from 'react-router-dom';

const navItems = [
  { label: '\uD648', to: '/' },
  { label: '\uC7AC\uB8CC \uAD00\uB9AC', to: '/ingredients' },
  { label: '\uC7AC\uB8CC \uCD94\uAC00', to: '/ingredients/new' },
  { label: '\uC601\uC218\uC99D \uBD88\uB7EC\uC624\uAE30', to: '/import' },
  { label: '\uB808\uC2DC\uD53C', to: '/recipes' }
];

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/50 bg-[#fbf8f2]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="kicker">FridgeMate</p>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {'\uD63C\uC790 \uC0B4\uC544\uB3C4 \uC0B0\uB73B\uD558\uAC8C \uC4F0\uB294 \uB0C9\uC7A5\uACE0 \uB8E8\uD2F4'}
              </h1>
              <p className="mt-1 text-sm muted">
                {'\uC7AC\uB8CC \uAD00\uB9AC, \uC720\uD1B5\uAE30\uD55C \uD655\uC778, \uB808\uC2DC\uD53C \uCC3E\uAE30\uB97C \uD558\uB098\uC758 \uD750\uB984\uC73C\uB85C \uC5F0\uACB0\uD574\uBCF4\uC138\uC694.'}
              </p>
            </div>
          </div>

          <div className="glass-card flex w-full max-w-full gap-2 overflow-x-auto p-2 lg:w-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-white/70 text-slate-600 hover:bg-white hover:text-slate-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
