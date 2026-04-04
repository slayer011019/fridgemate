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
  const hasMemo = Boolean(String(ingredient.memo || '').trim());

  return (
    <article className="glass-card p-3.5">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)_auto] xl:items-start">
        <div className="min-w-0 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-slate-900">{ingredient.name}</h3>
            <span className={`badge ${toneClass}`}>{expiryLabel}</span>
            {ingredient.consumed ? <span className="badge bg-slate-200 text-slate-700">재등록 필요</span> : null}
            {hasMemo ? <span className="badge bg-amber-100 text-amber-800">메모 있음</span> : null}
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">구매일</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{ingredient.purchaseDate || '-'}</p>
          </div>
          <div className="rounded-[16px] border border-white/70 bg-white/70 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">유통기한</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{ingredient.expiryDate || '미입력'}</p>
            <p className="mt-1 text-xs muted">{getRemainingText(remainingDays)}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 xl:flex-col xl:items-end">
          <button type="button" className="btn-secondary px-3.5 py-2" onClick={() => onToggleConsumed(ingredient)}>
            {ingredient.consumed ? '보유 중으로 변경' : '소비 처리'}
          </button>
          <Link className="btn-secondary px-3.5 py-2" to={`/ingredients/${ingredient.id}/edit`}>
            수정
          </Link>
          {!ingredient.consumed ? (
            <button
              type="button"
              className="inline-flex min-h-[2.5rem] items-center justify-center rounded-full bg-rose-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-600"
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
    <section className="grid gap-2.5 xl:grid-cols-2">
      {ingredients.map((ingredient) => (
        <IngredientCard key={ingredient.id} ingredient={ingredient} onDelete={onDelete} onToggleConsumed={onToggleConsumed} />
      ))}
    </section>
  );
}

export default memo(IngredientList);
