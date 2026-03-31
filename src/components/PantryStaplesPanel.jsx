import { memo } from 'react';
import { PANTRY_STATUS } from '../data/pantryStaples';

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

function PantryStaplesPanel({ items, pantryOwnership, pantrySummary, onCycle }) {
  return (
    <div className="rounded-[24px] border border-white/70 bg-white/75 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="kicker">기본 조미료 / 팬트리</p>
          <h4 className="text-lg font-semibold text-slate-900">평소 갖춰두는 재료만 가볍게 체크해두세요</h4>
          <p className="text-sm leading-6 muted">
            냉장고 재료처럼 유통기한을 관리하지 않아도 되는 기본 조미료예요. 클릭할 때마다 보유 → 미보유 → 모름 순서로 바뀌고,
            장바구니와는 별개로 추천 계산에만 반영돼요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="badge bg-brand-50 text-brand-700">{`보유 ${pantrySummary.owned}`}</span>
          <span className="badge bg-rose-50 text-rose-700">{`미보유 ${pantrySummary.missing}`}</span>
          <span className="badge bg-white text-slate-600">{`모름 ${pantrySummary.unknown}`}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {items.map((item) => {
          const status = pantryOwnership[item.id] || PANTRY_STATUS.UNKNOWN;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onCycle(item.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition hover:-translate-y-0.5 ${statusClassName[status]}`}
            >
              <span>{item.name}</span>
              <span className="text-xs opacity-80">{statusLabel[status]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default memo(PantryStaplesPanel);
