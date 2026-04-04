import { memo } from 'react';

function StatCard({ label, value, tone = 'default', helper = '' }) {
  const toneClass = {
    default: 'bg-brand-50 text-brand-700',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-rose-100 text-rose-700'
  };

  return (
    <div className="card flex h-full flex-col gap-3">
      <div className={`badge w-fit ${toneClass[tone]}`}>{label}</div>
      <div className="space-y-1">
        <p className="text-[1.9rem] font-semibold tracking-tight text-slate-900">{value}</p>
        {helper ? <p className="text-sm leading-6 muted">{helper}</p> : null}
      </div>
    </div>
  );
}

export default memo(StatCard);
