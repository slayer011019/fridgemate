import { memo } from 'react';
import { Link } from 'react-router-dom';
import { getExpiryLabel, getRemainingDays, getStatusTone } from '../utils/date';
import { getCategoryLabel, getStorageLabel } from '../utils/displayText';

function getRemainingText(remainingDays) {
  if (remainingDays === null) {
    return '\uB0A0\uC9DC \uBBF8\uC785\uB825';
  }

  if (remainingDays < 0) {
    return `${Math.abs(remainingDays)}\uC77C \uC9C0\uB0A8`;
  }

  if (remainingDays === 0) {
    return '\uC624\uB298 \uC0AC\uC6A9 \uAD8C\uC7A5';
  }

  return `${remainingDays}\uC77C \uB0A8\uC74C`;
}

const IngredientCard = memo(function IngredientCard({ ingredient, onDelete, onToggleConsumed }) {
  const remainingDays = getRemainingDays(ingredient.expiryDate);
  const expiryLabel = getExpiryLabel(remainingDays);
  const toneClass = getStatusTone(remainingDays, ingredient.consumed);
  const hasMemo = Boolean(String(ingredient.memo || '').trim());

  return (
    <article className="glass-card p-3.5">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)_auto] xl:items-start">
        <div className="min-w-0 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-slate-900">{ingredient.name}</h3>
            <span className={`badge ${toneClass}`}>{expiryLabel}</span>
            {ingredient.consumed ? <span className="badge bg-slate-200 text-slate-700">{'\uC7AC\uB4F1\uB85D \uD544\uC694'}</span> : null}
            {hasMemo ? <span className="badge bg-amber-100 text-amber-800">{'\uBA54\uBAA8 \uC788\uC74C'}</span> : null}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <span className="badge bg-brand-50 text-brand-700">{getCategoryLabel(ingredient.category)}</span>
            <span className="badge bg-white text-slate-600">{getStorageLabel(ingredient.storageType)}</span>
            <span className="badge bg-white text-slate-600">{ingredient.quantity}</span>
          </div>

          {hasMemo ? <p className="line-clamp-1 text-sm muted">{ingredient.memo}</p> : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-[16px] border border-white/70 bg-white/70 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{'\uAD6C\uB9E4\uC77C'}</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{ingredient.purchaseDate || '-'}</p>
          </div>
          <div className="rounded-[16px] border border-white/70 bg-white/70 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{'\uC720\uD1B5\uAE30\uD55C'}</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{ingredient.expiryDate || '\uBBF8\uC785\uB825'}</p>
            <p className="mt-1 text-xs muted">{getRemainingText(remainingDays)}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 xl:flex-col xl:items-end">
          <button type="button" className="btn-secondary px-3.5 py-2" onClick={() => onToggleConsumed(ingredient)}>
            {ingredient.consumed ? '\uBCF4\uC720 \uC911\uC73C\uB85C \uBCC0\uACBD' : '\uC18C\uBE44 \uCC98\uB9AC'}
          </button>
          <Link className="btn-secondary px-3.5 py-2" to={`/ingredients/${ingredient.id}/edit`}>
            {'\uC218\uC815'}
          </Link>
          {!ingredient.consumed ? (
            <button
              type="button"
              className="inline-flex min-h-[2.5rem] items-center justify-center rounded-full bg-rose-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-600"
              onClick={() => onDelete(ingredient.id)}
            >
              {'\uC0AD\uC81C'}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
});

function IngredientList({ ingredients, onDelete, onToggleConsumed }) {
  if (!ingredients.length) {
    return null;
  }

  return (
    <section className="grid gap-2.5 xl:grid-cols-2">
      {ingredients.map((ingredient) => (
        <IngredientCard key={ingredient.id} ingredient={ingredient} onDelete={onDelete} onToggleConsumed={onToggleConsumed} />
      ))}
    </section>
  );
}

export default memo(IngredientList);
