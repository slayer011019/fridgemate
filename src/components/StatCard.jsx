function StatCard({ label, value, tone = 'default' }) {
  const toneClass = {
    default: 'bg-brand-50 text-brand-700',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-rose-100 text-rose-700'
  };

  return (
    <div className="card">
      <div className={`badge ${toneClass[tone]}`}>{label}</div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

export default StatCard;
