import { memo } from 'react';

function IngredientFilters({ filters, categories, storageTypes, onChange }) {
  const categoryOptions = [{ label: '\uC804\uCCB4', value: 'all' }, ...categories.map((category) => ({ label: category, value: category }))];

  return (
    <section className="glass-card space-y-3 p-3.5 sm:p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(18rem,1fr)_auto] lg:items-end">
        <label className="space-y-1.5 text-sm font-medium text-slate-700">
          {'\uAC80\uC0C9'}
          <input
            className="min-h-[2.7rem]"
            value={filters.query}
            onChange={(event) => onChange('query', event.target.value)}
            placeholder={'\uC7AC\uB8CC\uBA85 \uB610\uB294 \uBA54\uBAA8 \uAC80\uC0C9'}
          />
        </label>

        <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[32rem]">
          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            {'\uBCF4\uAD00'}
            <select className="min-h-[2.7rem]" value={filters.storageType} onChange={(event) => onChange('storageType', event.target.value)}>
              <option value="all">{'\uC804\uCCB4 \uBCF4\uAD00'}</option>
              {storageTypes.map((storageType) => (
                <option key={storageType} value={storageType}>
                  {storageType}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            {'\uC815\uB82C'}
            <select className="min-h-[2.7rem]" value={filters.sortOrder} onChange={(event) => onChange('sortOrder', event.target.value)}>
              <option value="asc">{'\uC784\uBC15 \uC21C'}</option>
              <option value="desc">{'\uB290\uB9B0 \uC21C'}</option>
            </select>
          </label>

          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            {'\uC0C1\uD0DC'}
            <select className="min-h-[2.7rem]" value={filters.status} onChange={(event) => onChange('status', event.target.value)}>
              <option value="all">{'\uC804\uCCB4'}</option>
              <option value="active">{'\uBCF4\uC720 \uC911'}</option>
              <option value="consumed">{'\uC7AC\uB4F1\uB85D'}</option>
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-[18px] border border-brand-100/70 bg-white/58 p-2">
        <div className="touch-pan-x flex gap-1.5 overflow-x-auto">
          {categoryOptions.map((option) => {
            const isActive = filters.category === option.value;

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => onChange('category', option.value)}
                className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/20'
                    : 'bg-white/78 text-slate-600 hover:bg-brand-50 hover:text-slate-900'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default memo(IngredientFilters);
