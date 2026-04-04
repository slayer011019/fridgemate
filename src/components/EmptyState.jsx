function EmptyState({ title, description }) {
  return (
    <div className="card border-dashed border-brand-100/70 bg-white/65 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-xl">◎</div>
      <h3 className="mt-3 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 muted">{description}</p>
    </div>
  );
}

export default EmptyState;
