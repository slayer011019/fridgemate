import { memo } from 'react';

function IngredientFilters({ filters, categories, storageTypes, onChange }) {
  return (
    <section className="card grid gap-2.5 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))]">
      <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2 lg:col-span-3 2xl:col-span-1">
        {'\uAC80\uC0C9'}
        <input
          className="min-h-[2.7rem]"
          value={filters.query}
          onChange={(event) => onChange('query', event.target.value)}
          placeholder={'\uC7AC\uB8CC\uBA85 \uB610\uB294 \uBA54\uBAA8 \uAC80\uC0C9'}
        />
      </label>

      <label className="space-y-1 text-sm font-medium text-slate-700">
        {'\uCE74\uD14C\uACE0\uB9AC'}
        <select className="min-h-[2.7rem]" value={filters.category} onChange={(event) => onChange('category', event.target.value)}>
          <option value="all">{'\uC804\uCCB4 \uCE74\uD14C\uACE0\uB9AC'}</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1 text-sm font-medium text-slate-700">
        {'\uBCF4\uAD00 \uBC29\uC2DD'}
        <select className="min-h-[2.7rem]" value={filters.storageType} onChange={(event) => onChange('storageType', event.target.value)}>
          <option value="all">{'\uC804\uCCB4 \uBCF4\uAD00 \uBC29\uC2DD'}</option>
          {storageTypes.map((storageType) => (
            <option key={storageType} value={storageType}>
              {storageType}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1 text-sm font-medium text-slate-700">
        {'\uC815\uB82C'}
        <select className="min-h-[2.7rem]" value={filters.sortOrder} onChange={(event) => onChange('sortOrder', event.target.value)}>
          <option value="asc">{'\uC720\uD1B5\uAE30\uD55C \uC784\uBC15 \uC21C'}</option>
          <option value="desc">{'\uC720\uD1B5\uAE30\uD55C \uB290\uB9B0 \uC21C'}</option>
        </select>
      </label>

      <label className="space-y-1 text-sm font-medium text-slate-700">
        {'\uC0C1\uD0DC'}
        <select className="min-h-[2.7rem]" value={filters.status} onChange={(event) => onChange('status', event.target.value)}>
          <option value="all">{'\uC804\uCCB4 \uC7AC\uB8CC'}</option>
          <option value="active">{'\uBCF4\uC720 \uC911\uB9CC'}</option>
          <option value="consumed">{'\uC7AC\uB4F1\uB85D \uD544\uC694\uB9CC'}</option>
        </select>
      </label>
    </section>
  );
}

export default memo(IngredientFilters);
