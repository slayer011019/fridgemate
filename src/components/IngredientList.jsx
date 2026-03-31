import { Link } from 'react-router-dom';
import { getExpiryLabel, getRemainingDays, getStatusTone } from '../utils/date';
import { getCategoryLabel, getStorageLabel } from '../utils/displayText';

function getRemainingText(remainingDays) {
  if (remainingDays === null) {
    return '-';
  }

  if (remainingDays < 0) {
    return `${Math.abs(remainingDays)}\uC77C \uC9C0\uB0A8`;
  }

  if (remainingDays === 0) {
    return '\uC624\uB298 \uC0AC\uC6A9 \uAD8C\uC7A5';
  }

  return `${remainingDays}\uC77C \uB0A8\uC74C`;
}

function IngredientList({ ingredients, onDelete, onToggleConsumed }) {
  if (!ingredients.length) {
    return null;
  }

  return (
    <section className="grid gap-4">
      {ingredients.map((ingredient) => {
        const remainingDays = getRemainingDays(ingredient.expiryDate);
        const expiryLabel = getExpiryLabel(remainingDays);
        const toneClass = getStatusTone(remainingDays, ingredient.consumed);

        return (
          <article key={ingredient.id} className="card">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold text-slate-900">{ingredient.name}</h3>
                    <span className={`badge ${toneClass}`}>{expiryLabel}</span>
                    {ingredient.consumed ? <span className="badge bg-slate-200 text-slate-700">{'\uC18C\uBE44 \uC644\uB8CC'}</span> : null}
                  </div>

                  <div className="flex flex-wrap gap-2 text-sm muted">
                    <span className="badge bg-brand-50 text-brand-700">{getCategoryLabel(ingredient.category)}</span>
                    <span className="badge bg-white text-slate-600">{getStorageLabel(ingredient.storageType)}</span>
                    <span className="badge bg-white text-slate-600">{ingredient.quantity}</span>
                  </div>
                </div>

                <div className="soft-panel min-w-[10rem]">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{'\uC720\uD1B5\uAE30\uD55C \uC0C1\uD0DC'}</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{getRemainingText(remainingDays)}</p>
                  <p className="mt-1 text-sm muted">{ingredient.expiryDate || '\uBBF8\uC785\uB825'}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="soft-panel">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{'\uAD6C\uB9E4 / \uBA54\uBAA8'}</p>
                  <div className="mt-3 space-y-2 text-sm muted">
                    <p>{`\uAD6C\uB9E4\uC77C ${ingredient.purchaseDate || '-'}`}</p>
                    <p>{`\uBA54\uBAA8 ${ingredient.memo || '-'}`}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-2 sm:justify-end">
                  <button type="button" className="btn-secondary" onClick={() => onToggleConsumed(ingredient)}>
                    {ingredient.consumed ? '\uBCF4\uC720 \uC911\uC73C\uB85C \uBCC0\uACBD' : '\uC18C\uBE44 \uC644\uB8CC \uCC98\uB9AC'}
                  </button>
                  <Link className="btn-secondary" to={`/ingredients/${ingredient.id}/edit`}>
                    {'\uC218\uC815'}
                  </Link>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full bg-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-rose-600"
                    onClick={() => onDelete(ingredient.id)}
                  >
                    {'\uC0AD\uC81C'}
                  </button>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}

export default IngredientList;
