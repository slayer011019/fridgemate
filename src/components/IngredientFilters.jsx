import { memo } from 'react';

function IngredientFilters({ filters, categories, storageTypes, onChange }) {
  return (
    <section className="card grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <label className="space-y-1.5 text-sm font-medium text-slate-700">
        {'\uCE74\uD14C\uACE0\uB9AC'}
        <select value={filters.category} onChange={(event) => onChange('category', event.target.value)}>
          <option value="all">{'\uC804\uCCB4 \uCE74\uD14C\uACE0\uB9AC'}</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1.5 text-sm font-medium text-slate-700">
        {'\uBCF4\uAD00 \uBC29\uC2DD'}
        <select value={filters.storageType} onChange={(event) => onChange('storageType', event.target.value)}>
          <option value="all">{'\uC804\uCCB4 \uBCF4\uAD00 \uBC29\uC2DD'}</option>
          {storageTypes.map((storageType) => (
            <option key={storageType} value={storageType}>
              {storageType}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1.5 text-sm font-medium text-slate-700">
        {'\uC720\uD1B5\uAE30\uD55C \uC815\uB82C'}
        <select value={filters.sortOrder} onChange={(event) => onChange('sortOrder', event.target.value)}>
          <option value="asc">{'\uAC00\uAE4C\uC6B4 \uB0A0\uC9DC \uC21C'}</option>
          <option value="desc">{'\uBA3C \uB0A0\uC9DC \uC21C'}</option>
        </select>
      </label>

      <label className="space-y-1.5 text-sm font-medium text-slate-700">
        {'\uC0C1\uD0DC'}
        <select value={filters.status} onChange={(event) => onChange('status', event.target.value)}>
          <option value="all">{'\uC804\uCCB4 \uC7AC\uB8CC'}</option>
          <option value="active">{'\uBCF4\uC720 \uC911\uB9CC'}</option>
          <option value="consumed">{'\uC7AC\uB4F1\uB85D \uD544\uC694\uB9CC'}</option>
        </select>
      </label>
    </section>
  );
}

export default memo(IngredientFilters);
