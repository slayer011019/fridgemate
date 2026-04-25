import { ingredientCategories, storageTypes } from '../../utils/ingredientOptions';

function ConfidenceBadge({ confidence }) {
  if (confidence >= 0.7) {
    return <span className="badge bg-emerald-100 text-emerald-700">{'\uD655\uC778\uB428'}</span>;
  }

  if (confidence >= 0.5) {
    return <span className="badge bg-amber-100 text-amber-800">{'\uAC80\uD1A0 \uAD8C\uC7A5'}</span>;
  }

  return <span className="badge bg-rose-100 text-rose-700">{'\uD655\uC778 \uD544\uC694'}</span>;
}

function ParsedItemEditor({ items, onItemChange, onToggleItem, onSelectAll, onDeselectAll, onImport }) {
  const selectedCount = items.filter((item) => item.selected).length;

  return (
    <section className="card space-y-3.5">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="kicker">{'3. \uD6C4\uBCF4 \uAC80\uD1A0'}</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900 sm:text-[1.35rem]">
            {'\uAC00\uC838\uC624\uAE30 \uC804\uC5D0 \uD56D\uBAA9\uC744 \uD55C \uBC88 \uD655\uC778\uD574\uBCF4\uC138\uC694'}
          </h3>
          <p className="mt-1.5 text-sm leading-5.5 muted">
            {
              '\uAC00\uC838\uC62C \uD56D\uBAA9\uB9CC \uC120\uD0DD\uD558\uACE0, \uC774\uB984\uACFC \uC218\uB7C9, \uCE74\uD14C\uACE0\uB9AC, \uBCF4\uAD00 \uBC29\uC2DD\uC744 \uAC00\uBCBC\uAC8C \uB2E4\uB4EC\uC5B4\uBCF4\uC138\uC694.'
            }
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

      <div className="soft-panel flex flex-wrap items-center justify-between gap-2 text-sm text-slate-700">
        <span>{`\uC804\uCCB4 ${items.length}\uAC1C \uC911 ${selectedCount}\uAC1C \uC120\uD0DD\uB428`}</span>
        <span className="badge bg-white text-slate-600">{'\uC120\uD0DD\uB41C \uD56D\uBAA9\uB9CC \uAC00\uC838\uC635\uB2C8\uB2E4'}</span>
      </div>

      <div className="space-y-2.5">
        {items.map((item) => (
          <article key={item.id} className="rounded-[18px] border border-white/60 bg-white/65 p-3 shadow-sm">
            <div className="grid gap-2.5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2.5">
                  <label className="flex min-w-0 items-center gap-2.5 text-sm font-medium text-slate-800">
                    <input type="checkbox" checked={item.selected} onChange={() => onToggleItem(item.id)} />
                    <span className="whitespace-nowrap">{'\uC774 \uD56D\uBAA9 \uAC00\uC838\uC624\uAE30'}</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {item.learnedCorrection ? (
                      <span className="badge bg-amber-100 text-amber-700">{'\uC774\uC804 \uC218\uC815 \uC774\uB825 \uBC18\uC601'}</span>
                    ) : null}
                    {item.needsReview ? (
                      <span className="badge bg-amber-100 text-amber-700">{'\uC218\uB3D9 \uD655\uC778 \uD544\uC694'}</span>
                    ) : null}
                    <span className="badge bg-brand-50 text-brand-700">{'\uC790\uB3D9 \uCD94\uCD9C\uB428'}</span>
                  </div>
                </div>

                <div className="rounded-[16px] bg-slate-50/80 p-2.5 text-sm text-slate-700">
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{'\uAC04\uC18C\uD654\uB41C \uC774\uB984'}</p>
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <p className="truncate font-medium text-slate-900">{item.displayName || item.normalizedName || item.name || '-'}</p>
                        <ConfidenceBadge confidence={item.confidence} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{'\uCD94\uCD9C\uB41C \uC218\uB7C9'}</p>
                      <p className="font-medium text-slate-900">{item.specText || item.quantity || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-2.5 md:grid-cols-2 2xl:grid-cols-3">
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  {'\uC774\uB984'}
                  <input value={item.name} onChange={(event) => onItemChange(item.id, 'name', event.target.value)} />
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700">
                  {'\uC218\uB7C9'}
                  <input
                    value={item.quantity || ''}
                    placeholder={!item.quantity ? '\uC218\uB7C9 \uBBF8\uD655\uC778' : ''}
                    className={!item.quantity ? 'border-amber-300' : undefined}
                    onChange={(event) => onItemChange(item.id, 'quantity', event.target.value)}
                  />
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700">
                  {'\uCE74\uD14C\uACE0\uB9AC'}
                  <select value={item.category} onChange={(event) => onItemChange(item.id, 'category', event.target.value)}>
                    {ingredientCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700">
                  {'\uBCF4\uAD00 \uBC29\uC2DD'}
                  <select value={item.storageType} onChange={(event) => onItemChange(item.id, 'storageType', event.target.value)}>
                    {storageTypes.map((storageType) => (
                      <option key={storageType} value={storageType}>
                        {storageType}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700">
                  {'\uAD6C\uB9E4\uC77C'}
                  <input
                    type="date"
                    value={item.purchaseDate}
                    onChange={(event) => onItemChange(item.id, 'purchaseDate', event.target.value)}
                  />
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700">
                  {'\uC720\uD1B5\uAE30\uD55C'}
                  <input
                    type="date"
                    value={item.expiryDate}
                    onChange={(event) => onItemChange(item.id, 'expiryDate', event.target.value)}
                  />
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2 2xl:col-span-3">
                  {'\uBA54\uBAA8'}
                  <input
                    value={item.memo}
                    placeholder={'\uD544\uC694\uD558\uBA74 \uC9C1\uC811 \uBA54\uBAA8\uB97C \uB0A8\uACA8\uBCF4\uC138\uC694'}
                    onChange={(event) => onItemChange(item.id, 'memo', event.target.value)}
                  />
                </label>
              </div>
            </div>
            {item.rawLine ? <p className="mt-1 truncate text-xs text-slate-400">{item.rawLine}</p> : null}
          </article>
        ))}
      </div>

      <div className="flex flex-wrap gap-2.5">
        <button type="button" className="btn-primary" onClick={onImport}>
          {'\uC120\uD0DD\uD55C \uD56D\uBAA9 \uAC00\uC838\uC624\uAE30'}
        </button>
      </div>
    </section>
  );
}

export default ParsedItemEditor;
