import { memo, useMemo } from 'react';
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

      <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">기본 팬트리</p>
            <p className="mt-1 text-xs muted">한식 집밥에서 자주 쓰는 20개를 먼저 확인하세요.</p>
          </div>
          {basicPantryStapleCategories.map((category) => (
            <PantryCategoryGroup
              key={`basic-${category.title}`}
              title={category.title}
              items={category.items}
              pantryOwnership={pantryOwnership}
              onCycle={onCycle}
            />
          ))}
        </div>

        <div className="space-y-4 border-t border-slate-100 pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
          <div>
            <p className="text-sm font-semibold text-slate-900">추가 조미료</p>
            <p className="mt-1 text-xs muted">있으면 추천 정확도를 더 보조하는 선택 재료입니다.</p>
          </div>
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
      </div>
    </div>
  );
}

export default memo(PantryStaplesPanel);
