import { Link } from 'react-router-dom';

function EmptyState({ title, description, compact = false, actionLabel = '', actionTo = '', icon = '🥕', className = '' }) {
  return (
    <div
      className={`rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center shadow-sm ${
        compact ? 'py-4' : 'py-7'
      } ${className}`}
    >
      <div className={`${compact ? 'text-4xl' : 'text-5xl'} mx-auto leading-none`} aria-hidden="true">
        {icon}
      </div>
      <h3 className={`${compact ? 'mt-3 text-base' : 'mt-4 text-lg'} font-semibold text-stone-800`}>{title}</h3>
      <p className={`${compact ? 'mt-1.5 text-sm leading-5' : 'mt-2 text-sm leading-6'} mx-auto max-w-md text-stone-500`}>
        {description}
      </p>
      {actionLabel && actionTo ? (
        <Link
          to={actionTo}
          className="mt-4 inline-flex min-h-[2.5rem] items-center justify-center rounded-md bg-green-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-800"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export default EmptyState;
