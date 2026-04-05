import { ingredientCategories, storageTypes } from '../../utils/ingredientOptions';

function ParsedItemEditor({ items, onItemChange, onToggleItem, onSelectAll, onDeselectAll, onImport }) {
  const selectedCount = items.filter((item) => item.selected).length;

  return (
    <section className="card space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="kicker">{'3. \uD6C4\uBCF4 \uAC80\uD1A0'}</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">
            {'\uAC00\uC838\uC624\uAE30 \uC804\uC5D0 \uD56D\uBAA9\uC744 \uD55C \uBC88 \uD655\uC778\uD574\uBCF4\uC138\uC694'}
          </h3>
          <p className="mt-2 text-sm leading-6 muted">
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
        <span className="badge bg-white text-slate-600">{'\uBE60\uB974\uAC8C \uAC80\uD1A0\uD558\uACE0 \uD544\uC694\uD55C \uD56D\uBAA9\uB9CC \uAC00\uC838\uC624\uAE30'}</span>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-[20px] border border-white/60 bg-white/65 p-3.5 shadow-sm">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.28fr)]">
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <label className="flex min-w-0 items-center gap-3 text-sm font-medium text-slate-800">
                    <input type="checkbox" checked={item.selected} onChange={() => onToggleItem(item.id)} />
                    <span className="whitespace-nowrap">{'\uC774 \uD56D\uBAA9 \uAC00\uC838\uC624\uAE30'}</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {item.learnedCorrection ? (
                      <span className="badge bg-amber-100 text-amber-700">{'\uC774\uC804 \uC218\uC815 \uC774\uB825 \uBC18\uC601'}</span>
                    ) : null}
                    <span className="badge bg-brand-50 text-brand-700">{'\uC790\uB3D9 \uCD94\uCD9C\uB428'}</span>
                  </div>
                </div>

                <div className="rounded-[18px] bg-slate-50/80 p-3 text-sm text-slate-700">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{'\uAC04\uC18C\uD654\uB41C \uC774\uB984'}</p>
                      <p className="font-medium text-slate-900">{item.displayName || item.normalizedName || item.name || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{'\uCD94\uCD9C\uB41C \uC218\uB7C9'}</p>
                      <p className="font-medium text-slate-900">{item.specText || item.quantity || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <label className="space-y-1.5 text-sm font-medium text-slate-700">
                  {'\uC774\uB984'}
                  <input value={item.name} onChange={(event) => onItemChange(item.id, 'name', event.target.value)} />
                </label>

                <label className="space-y-1.5 text-sm font-medium text-slate-700">
                  {'\uC218\uB7C9'}
                  <input value={item.quantity} onChange={(event) => onItemChange(item.id, 'quantity', event.target.value)} />
                </label>

                <label className="space-y-1.5 text-sm font-medium text-slate-700">
                  {'\uCE74\uD14C\uACE0\uB9AC'}
                  <select value={item.category} onChange={(event) => onItemChange(item.id, 'category', event.target.value)}>
                    {ingredientCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1.5 text-sm font-medium text-slate-700">
                  {'\uBCF4\uAD00 \uBC29\uC2DD'}
                  <select value={item.storageType} onChange={(event) => onItemChange(item.id, 'storageType', event.target.value)}>
                    {storageTypes.map((storageType) => (
                      <option key={storageType} value={storageType}>
                        {storageType}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1.5 text-sm font-medium text-slate-700">
                  {'\uAD6C\uB9E4\uC77C'}
                  <input
                    type="date"
                    value={item.purchaseDate}
                    onChange={(event) => onItemChange(item.id, 'purchaseDate', event.target.value)}
                  />
                </label>

                <label className="space-y-1.5 text-sm font-medium text-slate-700">
                  {'\uC720\uD1B5\uAE30\uD55C'}
                  <input
                    type="date"
                    value={item.expiryDate}
                    onChange={(event) => onItemChange(item.id, 'expiryDate', event.target.value)}
                  />
                </label>

                <label className="space-y-1.5 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-3">
                  {'\uBA54\uBAA8'}
                  <input
                    value={item.memo}
                    placeholder={'\uD544\uC694\uD558\uBA74 \uC9C1\uC811 \uBA54\uBAA8\uB97C \uB0A8\uACA8\uBCF4\uC138\uC694'}
                    onChange={(event) => onItemChange(item.id, 'memo', event.target.value)}
                  />
                </label>
              </div>
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
