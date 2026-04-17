import { memo } from 'react';

function StatCard({ label, value, tone = 'default', helper = '' }) {
  const toneClass = {
    default: 'bg-brand-50 text-brand-700',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-rose-100 text-rose-700'
  };

  return (
    <div className="card flex h-full flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <div className={`badge w-fit ${toneClass[tone]}`}>{label}</div>
        {helper ? <p className="text-sm leading-5.5 muted">{helper}</p> : null}
      </div>
      <div className="text-left sm:text-right">
        <p className="text-[1.85rem] font-semibold tracking-tight text-slate-900">{value}</p>
      </div>
    </div>
  );
}

export default memo(StatCard);
