import { ingredientCategories, storageTypes } from '../../utils/ingredientOptions';

function ParsedItemEditor({ items, onItemChange, onToggleItem, onSelectAll, onDeselectAll, onImport }) {
  const selectedCount = items.filter((item) => item.selected).length;

  return (
    <section className="card space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="kicker">3. 후보 검토</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">가져오기 전에 항목을 한 번 확인해보세요</h3>
          <p className="mt-2 text-sm leading-6 muted">
            가져올 항목만 선택하고, 이름과 수량, 카테고리, 보관 방식만 가볍게 다듬어보세요. 유통기한은 나중에 입력해도 괜찮아요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={onSelectAll}>
            전체 선택
          </button>
          <button type="button" className="btn-secondary" onClick={onDeselectAll}>
            전체 해제
          </button>
        </div>
      </div>

      <div className="soft-panel flex flex-wrap items-center justify-between gap-2 text-sm text-slate-700">
        <span>{`전체 ${items.length}개 중 ${selectedCount}개 선택됨`}</span>
        <span className="badge bg-white text-slate-600">빠르게 검토하고 필요한 항목만 가져오기</span>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-[20px] border border-white/60 bg-white/65 p-3.5 shadow-sm">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.28fr)]">
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <label className="flex min-w-0 items-center gap-3 text-sm font-medium text-slate-800">
                    <input type="checkbox" checked={item.selected} onChange={() => onToggleItem(item.id)} />
                    <span className="whitespace-nowrap">이 항목 가져오기</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {item.learnedCorrection ? (
                      <span className="badge bg-amber-100 text-amber-700">이전 수정 이력 반영</span>
                    ) : null}
                    <span className="badge bg-brand-50 text-brand-700">자동 추출됨</span>
                  </div>
                </div>

                <div className="rounded-[18px] bg-slate-50/80 p-3 text-sm text-slate-700">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">간소화된 이름</p>
                      <p className="font-medium text-slate-900">{item.displayName || item.normalizedName || item.name || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">추출된 수량</p>
                      <p className="font-medium text-slate-900">{item.specText || item.quantity || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <label className="space-y-1.5 text-sm font-medium text-slate-700">
                  이름
                  <input value={item.name} onChange={(event) => onItemChange(item.id, 'name', event.target.value)} />
                </label>

                <label className="space-y-1.5 text-sm font-medium text-slate-700">
                  수량
                  <input value={item.quantity} onChange={(event) => onItemChange(item.id, 'quantity', event.target.value)} />
                </label>

                <label className="space-y-1.5 text-sm font-medium text-slate-700">
                  카테고리
                  <select value={item.category} onChange={(event) => onItemChange(item.id, 'category', event.target.value)}>
                    {ingredientCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1.5 text-sm font-medium text-slate-700">
                  보관 방식
                  <select value={item.storageType} onChange={(event) => onItemChange(item.id, 'storageType', event.target.value)}>
                    {storageTypes.map((storageType) => (
                      <option key={storageType} value={storageType}>
                        {storageType}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1.5 text-sm font-medium text-slate-700">
                  구매일
                  <input
                    type="date"
                    value={item.purchaseDate}
                    onChange={(event) => onItemChange(item.id, 'purchaseDate', event.target.value)}
                  />
                </label>

                <label className="space-y-1.5 text-sm font-medium text-slate-700">
                  유통기한
                  <span className="block text-xs font-normal text-slate-500">필요하면 나중에 입력해도 돼요</span>
                  <input
                    type="date"
                    value={item.expiryDate}
                    onChange={(event) => onItemChange(item.id, 'expiryDate', event.target.value)}
                  />
                </label>

                <label className="space-y-1.5 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-3">
                  메모
                  <input
                    value={item.memo}
                    placeholder="필요하면 직접 메모를 남겨보세요"
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
          선택한 항목 가져오기
        </button>
      </div>
    </section>
  );
}

export default ParsedItemEditor;
