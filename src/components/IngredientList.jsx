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

const actionButtonClassName =
  'inline-flex min-h-[2.15rem] items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm';

const IngredientCard = memo(function IngredientCard({ ingredient, onDelete, onToggleConsumed }) {
  const remainingDays = getRemainingDays(ingredient.expiryDate);
  const expiryLabel = getExpiryLabel(remainingDays);
  const toneClass = getStatusTone(remainingDays, ingredient.consumed);
  const hasMemo = Boolean(String(ingredient.memo || '').trim());

  return (
    <article className="glass-card p-3">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-[0.96rem] font-semibold text-slate-900">{ingredient.name}</h3>
            <span className={`badge ${toneClass}`}>{expiryLabel}</span>
            {ingredient.consumed ? <span className="badge bg-slate-200 text-slate-700">{'\uC7AC\uB4F1\uB85D \uD544\uC694'}</span> : null}
            {hasMemo ? <span className="badge bg-amber-100 text-amber-800">{'\uBA54\uBAA8'}</span> : null}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <span className="badge bg-brand-50 text-brand-700">{getCategoryLabel(ingredient.category)}</span>
            <span className="badge bg-white text-slate-600">{getStorageLabel(ingredient.storageType)}</span>
            <span className="badge bg-white text-slate-600">{ingredient.quantity}</span>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
            <span>{`\uAD6C\uB9E4\uC77C ${ingredient.purchaseDate || '-'}`}</span>
            <span>{`\uC720\uD1B5\uAE30\uD55C ${ingredient.expiryDate || '\uBBF8\uC785\uB825'}`}</span>
            <span className="font-medium text-slate-700">{getRemainingText(remainingDays)}</span>
          </div>

          {hasMemo ? <p className="line-clamp-1 text-xs muted">{ingredient.memo}</p> : null}
        </div>

        <div className="flex flex-wrap gap-1.5 xl:max-w-[8.5rem] xl:justify-end xl:self-end">
          <button
            type="button"
            className={`${actionButtonClassName} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
            onClick={() => onToggleConsumed(ingredient)}
          >
            {ingredient.consumed ? '\uBCF4\uC720' : '\uC18C\uBE44'}
          </button>
          <Link
            className={`${actionButtonClassName} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
            to={`/ingredients/${ingredient.id}/edit`}
          >
            {'\uC218\uC815'}
          </Link>
          {!ingredient.consumed ? (
            <button
              type="button"
              className={`${actionButtonClassName} bg-rose-500 text-white hover:bg-rose-600`}
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
    <section className="grid gap-2 xl:grid-cols-2 2xl:grid-cols-3">
      {ingredients.map((ingredient) => (
        <IngredientCard key={ingredient.id} ingredient={ingredient} onDelete={onDelete} onToggleConsumed={onToggleConsumed} />
      ))}
    </section>
  );
}

export default memo(IngredientList);
