function PageHeader({ eyebrow, title, description, action }) {
  return (
    <section className="card relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-24 rounded-t-[28px] bg-gradient-to-r from-brand-50/80 via-white/0 to-amber-50/70" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl space-y-3">
          {eyebrow ? <p className="kicker">{eyebrow}</p> : null}
          <div className="space-y-2">
            <h2 className="section-title">{title}</h2>
            {description ? <p className="max-w-2xl text-sm leading-6 muted sm:text-[0.95rem]">{description}</p> : null}
          </div>
        </div>
        {action ? <div className="flex flex-wrap gap-3">{action}</div> : null}
      </div>
    </section>
  );
}

export default PageHeader;
