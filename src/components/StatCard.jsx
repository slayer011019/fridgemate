import { memo } from 'react';

function StatCard({ label, value, tone = 'default', helper = '', emptyMessage = '' }) {
  const toneClass = {
    default: 'border border-green-100 bg-green-50 text-green-700',
    warning: 'border border-amber-100 bg-amber-50 text-amber-700',
    danger: 'border border-rose-100 bg-rose-50 text-rose-700'
  };

  return (
    <div className="card flex h-full flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <div className={`badge w-fit ${toneClass[tone]}`}>{label}</div>
        {helper ? <p className="text-sm leading-5.5 muted">{helper}</p> : null}
      </div>
      <div className="text-left sm:text-right">
        {emptyMessage ? (
          <p className="max-w-[11rem] text-sm font-semibold leading-5 text-stone-600">{emptyMessage}</p>
        ) : (
          <p className="text-[1.85rem] font-semibold tracking-tight text-stone-800">{value}</p>
        )}
      </div>
    </div>
  );
}

export default memo(StatCard);
