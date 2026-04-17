function PageHeader({ eyebrow, title, description, action }) {
  return (
    <section className="card relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-12 rounded-t-[22px] bg-gradient-to-r from-brand-50/85 via-white/10 to-amber-50/65" />
      <div className="relative flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl space-y-2">
          {eyebrow ? <p className="kicker">{eyebrow}</p> : null}
          <div className="space-y-1">
            <h2 className="section-title">{title}</h2>
            {description ? <p className="max-w-2xl text-sm leading-5.5 muted sm:text-[0.95rem]">{description}</p> : null}
          </div>
        </div>
        {action ? <div className="flex flex-wrap gap-2 lg:justify-end">{action}</div> : null}
      </div>
    </section>
  );
}

export default PageHeader;
