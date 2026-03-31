function EmptyState({ title, description }) {
  return (
    <div className="card border-dashed border-brand-100/70 bg-white/65 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-2xl">
        •
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 muted">{description}</p>
    </div>
  );
}

export default EmptyState;
