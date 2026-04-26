import { memo } from 'react';
import { PANTRY_STATUS } from '../data/pantryStaples';

const statusLabel = {
  [PANTRY_STATUS.OWNED]: '\uBCF4\uC720',
  [PANTRY_STATUS.MISSING]: '\uBBF8\uBCF4\uC720',
  [PANTRY_STATUS.UNKNOWN]: '\uBAA8\uB984'
};

const statusClassName = {
  [PANTRY_STATUS.OWNED]: 'border-brand-200 bg-brand-50 text-brand-700',
  [PANTRY_STATUS.MISSING]: 'border-rose-200 bg-rose-50 text-rose-700',
  [PANTRY_STATUS.UNKNOWN]: 'border-slate-200 bg-white text-slate-600'
};

function PantryStaplesPanel({ items, pantryOwnership, pantrySummary, onCycle }) {
  return (
    <div className="rounded-[20px] border border-white/70 bg-white/78 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <p className="kicker">{'\uAE30\uBCF8 \uC870\uBBF8\uB8CC \u002F \uD32C\uD2B8\uB9AC'}</p>
          <h4 className="text-lg font-semibold text-slate-900">{'\uC790\uC8FC \uC4F0\uB294 \uAE30\uBCF8 \uC7AC\uB8CC\uB9CC \uAC00\uBCBC\uAC8C \uCCB4\uD06C\uD558\uC138\uC694'}</h4>
          <p className="text-sm leading-5.5 muted">{'\uBCF4\uC720, \uBBF8\uBCF4\uC720, \uBAA8\uB984 \uC0C1\uD0DC\uB9CC \uAE30\uB85D\uD574 \uCD94\uCC9C \uC815\uD655\uB3C4\uB97C \uBCF4\uC870\uD569\uB2C8\uB2E4.'}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="badge bg-brand-50 text-brand-700">{`\uBCF4\uC720 ${pantrySummary.owned}`}</span>
          <span className="badge bg-rose-50 text-rose-700">{`\uBBF8\uBCF4\uC720 ${pantrySummary.missing}`}</span>
          <span className="badge bg-white text-slate-600">{`\uBAA8\uB984 ${pantrySummary.unknown}`}</span>
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
