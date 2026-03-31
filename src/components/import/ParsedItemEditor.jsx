import { ingredientCategories, storageTypes } from '../../utils/ingredientOptions';

function ParsedItemEditor({ items, onItemChange, onToggleItem, onSelectAll, onDeselectAll, onImport }) {
  const selectedCount = items.filter((item) => item.selected).length;

  return (
    <section className="card space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="kicker">{'3. \uD6C4\uBCF4 \uAC80\uD1A0'}</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900">{'\uAC00\uC838\uC624\uAE30 \uC804\uC5D0 \uD56D\uBAA9\uC744 \uD55C \uBC88 \uD655\uC778\uD574\uBCF4\uC138\uC694'}</h3>
          <p className="mt-2 text-sm leading-6 muted">
            {'\uAC00\uC838\uC62C \uD56D\uBAA9\uB9CC \uC120\uD0DD\uD558\uACE0, \uC774\uB984\uACFC \uC218\uB7C9, \uCE74\uD14C\uACE0\uB9AC, \uBCF4\uAD00 \uBC29\uC2DD\uB9CC \uAC00\uBC8D\uAC8C \uB2E4\uB4EC\uC5B4\uBCF4\uC138\uC694. \uC720\uD1B5\uAE30\uD55C\uC740 \uB098\uC911\uC5D0 \uC785\uB825\uD574\uB3C4 \uAD1C\uCC2E\uC544\uC694.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={onSelectAll}>
            {'\uC804\uCCB4 \uC120\uD0DD'}
          </button>
          <button type="button" className="btn-secondary" onClick={onDeselectAll}>
            {'\uC804\uCCB4 \uD574\uC81C'}
          </button>
        </div>
      </div>

      <div className="soft-panel text-sm text-slate-700">
        {`\uC804\uCCB4 ${items.length}\uAC1C \uC911 ${selectedCount}\uAC1C \uC120\uD0DD\uB428`}
      </div>

      <div className="space-y-4">
        {items.map((item) => (
          <article key={item.id} className="rounded-[24px] border border-white/60 bg-white/65 p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <label className="flex min-w-0 items-center gap-3 text-sm font-medium text-slate-800">
                <input type="checkbox" checked={item.selected} onChange={() => onToggleItem(item.id)} />
                <span className="whitespace-nowrap">{'\uC774 \uD56D\uBAA9 \uAC00\uC838\uC624\uAE30'}</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {item.learnedCorrection ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                    {'\uC774\uC804 \uC218\uC815 \uC774\uB825 \uBC18\uC601'}
                  </span>
                ) : null}
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                  {'\uC790\uB3D9 \uCD94\uCD9C\uB428'}
                </span>
              </div>
            </div>

            <div className="mb-4 grid gap-3 rounded-[20px] bg-slate-50/80 p-3 text-sm text-slate-700 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{'\uAC04\uC18C\uD654\uB41C \uC774\uB984'}</p>
                <p className="font-medium text-slate-900">{item.displayName || item.normalizedName || item.name || '-'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{'\uCD94\uCD9C\uB41C \uC218\uB7C9'}</p>
                <p className="font-medium text-slate-900">{item.specText || item.quantity || '-'}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-2 text-sm font-medium text-slate-700">
                {'\uC774\uB984'}
                <input value={item.name} onChange={(event) => onItemChange(item.id, 'name', event.target.value)} />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                {'\uC218\uB7C9'}
                <input value={item.quantity} onChange={(event) => onItemChange(item.id, 'quantity', event.target.value)} />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                {'\uCE74\uD14C\uACE0\uB9AC'}
                <select value={item.category} onChange={(event) => onItemChange(item.id, 'category', event.target.value)}>
                  {ingredientCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                {'\uBCF4\uAD00 \uBC29\uC2DD'}
                <select value={item.storageType} onChange={(event) => onItemChange(item.id, 'storageType', event.target.value)}>
                  {storageTypes.map((storageType) => (
                    <option key={storageType} value={storageType}>
                      {storageType}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                {'\uAD6C\uB9E4\uC77C'}
                <input
                  type="date"
                  value={item.purchaseDate}
                  onChange={(event) => onItemChange(item.id, 'purchaseDate', event.target.value)}
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                {'\uC720\uD1B5\uAE30\uD55C'}
                <span className="block text-xs font-normal text-slate-500">{'\uD544\uC694\uD558\uBA74 \uB098\uC911\uC5D0 \uC785\uB825\uD574\uB3C4 \uB3FC\uC694'}</span>
                <input
                  type="date"
                  value={item.expiryDate}
                  onChange={(event) => onItemChange(item.id, 'expiryDate', event.target.value)}
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-3">
                {'\uBA54\uBAA8'}
                <input
                  value={item.memo}
                  placeholder={'\uD544\uC694\uD558\uBA74 \uC9C1\uC811 \uBA54\uBAA8\uB97C \uB0A8\uACA8\uBCF4\uC138\uC694'}
                  onChange={(event) => onItemChange(item.id, 'memo', event.target.value)}
                />
              </label>
            </div>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-primary" onClick={onImport}>
          {'\uC120\uD0DD\uD55C \uD56D\uBAA9 \uAC00\uC838\uC624\uAE30'}
        </button>
      </div>
    </section>
  );
}

export default ParsedItemEditor;
