function EmptyState({ title, description, compact = false }) {
  return (
    <div className={`card border-dashed border-brand-100/70 bg-white/65 text-center ${compact ? 'py-3' : ''}`}>
      <div className={`${compact ? 'h-7 w-7 text-sm' : 'h-10 w-10 text-lg'} mx-auto flex items-center justify-center rounded-full bg-brand-50 text-brand-700`}>◎</div>
      <h3 className={`${compact ? 'mt-2 text-sm' : 'mt-3 text-lg'} font-semibold text-slate-900`}>{title}</h3>
      <p className={`${compact ? 'mt-1 text-xs leading-5' : 'mt-1.5 text-sm leading-5.5'} mx-auto max-w-md muted`}>{description}</p>
    </div>
  );
}

export default EmptyState;
