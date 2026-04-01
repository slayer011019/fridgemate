import { memo } from 'react';
import { Link } from 'react-router-dom';
import { getExpiryLabel, getRemainingDays, getStatusTone } from '../utils/date';
import { getCategoryLabel, getStorageLabel } from '../utils/displayText';

function getRemainingText(remainingDays) {
  if (remainingDays === null) {
    return '날짜 미입력';
  }

  if (remainingDays < 0) {
    return `${Math.abs(remainingDays)}일 지남`;
  }

  if (remainingDays === 0) {
    return '오늘 사용 권장';
  }

  return `${remainingDays}일 남음`;
}

const IngredientCard = memo(function IngredientCard({ ingredient, onDelete, onToggleConsumed }) {
  const remainingDays = getRemainingDays(ingredient.expiryDate);
  const expiryLabel = getExpiryLabel(remainingDays);
  const toneClass = getStatusTone(remainingDays, ingredient.consumed);

  return (
    <article className="glass-card p-4">
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-semibold text-slate-900">{ingredient.name}</h3>
              <span className={`badge ${toneClass}`}>{expiryLabel}</span>
              {ingredient.consumed ? <span className="badge bg-slate-200 text-slate-700">재등록 필요</span> : null}
            </div>
            <div className="flex flex-wrap gap-2 text-sm muted">
              <span className="badge bg-brand-50 text-brand-700">{getCategoryLabel(ingredient.category)}</span>
              <span className="badge bg-white text-slate-600">{getStorageLabel(ingredient.storageType)}</span>
              <span className="badge bg-white text-slate-600">{ingredient.quantity}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900">{getRemainingText(remainingDays)}</p>
            <p className="mt-1 text-xs muted">{ingredient.expiryDate || '유통기한 미입력'}</p>
          </div>
        </div>

        <div className="grid gap-2 text-sm text-slate-700">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/65 px-3 py-2">
            <span className="muted">구매일</span>
            <span>{ingredient.purchaseDate || '-'}</span>
          </div>
          <div className="rounded-2xl bg-white/65 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">메모</p>
            <p className="mt-1 line-clamp-2 text-sm text-slate-700">{ingredient.memo || '메모 없음'}</p>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => onToggleConsumed(ingredient)}>
            {ingredient.consumed ? '보유 중으로 변경' : '장바구니 재등록'}
          </button>
          <Link className="btn-secondary" to={`/ingredients/${ingredient.id}/edit`}>
            수정
          </Link>
          {!ingredient.consumed ? (
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-600"
              onClick={() => onDelete(ingredient.id)}
            >
              삭제
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
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {ingredients.map((ingredient) => (
        <IngredientCard key={ingredient.id} ingredient={ingredient} onDelete={onDelete} onToggleConsumed={onToggleConsumed} />
      ))}
    </section>
  );
}

export default memo(IngredientList);
