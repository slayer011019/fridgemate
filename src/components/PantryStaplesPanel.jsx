import { memo, useMemo, useState } from 'react';
import { extraPantryStapleCategories, basicPantryStapleCategories, PANTRY_STATUS } from '../data/pantryStaples';

const statusLabel = {
  [PANTRY_STATUS.OWNED]: '보유',
  [PANTRY_STATUS.MISSING]: '미보유',
  [PANTRY_STATUS.UNKNOWN]: '모름'
};

const statusClassName = {
  [PANTRY_STATUS.OWNED]: 'border-brand-200 bg-brand-50 text-brand-700',
  [PANTRY_STATUS.MISSING]: 'border-rose-200 bg-rose-50 text-rose-700',
  [PANTRY_STATUS.UNKNOWN]: 'border-slate-200 bg-white text-slate-600'
};

function PantryStapleButton({ item, status, onCycle }) {
  return (
    <button
      type="button"
      onClick={() => onCycle(item.id)}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition hover:-translate-y-0.5 ${statusClassName[status]}`}
    >
      <span>{item.name}</span>
      <span className="text-xs opacity-80">{statusLabel[status]}</span>
    </button>
  );
}

function PantryCategoryGroup({ title, items, pantryOwnership, onCycle }) {
  return (
    <section className="space-y-2">
      <h5 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</h5>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const status = pantryOwnership[item.id] || PANTRY_STATUS.UNKNOWN;

          return <PantryStapleButton key={item.id} item={item} status={status} onCycle={onCycle} />;
        })}
      </div>
    </section>
  );
}

function PantryStaplesPanel({ items, pantryOwnership, pantrySummary, onCycle }) {
  const [showExtraPantry, setShowExtraPantry] = useState(false);
  const categorizedIds = useMemo(
    () =>
      new Set(
        [...basicPantryStapleCategories, ...extraPantryStapleCategories].flatMap((category) =>
          category.items.map((item) => item.id)
        )
      ),
    []
  );
  const uncategorizedItems = useMemo(() => items.filter((item) => !categorizedIds.has(item.id)), [categorizedIds, items]);

  return (
    <div className="rounded-[20px] border border-white/70 bg-white/78 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <p className="kicker">{'기본 조미료 / 팬트리'}</p>
          <h4 className="text-lg font-semibold text-slate-900">{'자주 쓰는 기본 재료만 가볍게 체크하세요'}</h4>
          <p className="text-sm leading-5.5 muted">{'보유, 미보유, 모름 상태만 기록해 추천 정확도를 보조합니다.'}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="badge bg-brand-50 text-brand-700">{`보유 ${pantrySummary.owned}`}</span>
          <span className="badge bg-rose-50 text-rose-700">{`미보유 ${pantrySummary.missing}`}</span>
          <span className="badge bg-white text-slate-600">{`모름 ${pantrySummary.unknown}`}</span>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {basicPantryStapleCategories.map((category) => (
          <PantryCategoryGroup
            key={`basic-${category.title}`}
            title={category.title}
            items={category.items}
            pantryOwnership={pantryOwnership}
            onCycle={onCycle}
          />
        ))}

        <div className="border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setShowExtraPantry((current) => !current)}
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-brand-200 hover:text-brand-700"
            aria-expanded={showExtraPantry}
          >
            {showExtraPantry ? '추가 조미료 접기' : '추가 조미료 더보기'}
          </button>
        </div>

        {showExtraPantry ? (
          <div className="space-y-4 rounded-[16px] bg-slate-50/80 p-3">
            {extraPantryStapleCategories.map((category) => (
              <PantryCategoryGroup
                key={`extra-${category.title}`}
                title={category.title}
                items={category.items}
                pantryOwnership={pantryOwnership}
                onCycle={onCycle}
              />
            ))}
            {uncategorizedItems.length ? (
              <PantryCategoryGroup
                title={'기타'}
                items={uncategorizedItems}
                pantryOwnership={pantryOwnership}
                onCycle={onCycle}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default memo(PantryStaplesPanel);
