import { memo } from 'react';
import { joinIngredientLabels } from '../utils/displayText';

function RecipeCard({ recipe }) {
  const matchedIngredients = recipe.matchedIngredients || recipe.matchedCore || [];
  const missingIngredients = recipe.missingIngredients || recipe.missingCore || [];
  const totalCoreCount = recipe.totalRequiredIngredients ?? recipe.coreIngredients?.length ?? recipe.ingredients?.length ?? 0;

  return (
    <article className="card overflow-hidden">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="kicker">{recipe.category}</p>
              {recipe.useSoon ? <span className="badge bg-amber-100 text-amber-800">빨리 써야 해요</span> : null}
              {recipe.canMakeNow ? <span className="badge bg-brand-50 text-brand-700">지금 가능</span> : null}
            </div>
            <h3 className="text-lg font-semibold text-slate-900">{recipe.title}</h3>
            <p className="line-clamp-2 text-sm leading-6 muted">{recipe.description}</p>
            {recipe.reason ? (
              <div className="rounded-[16px] border border-brand-100/80 bg-brand-50/70 px-3 py-2 text-sm text-brand-900">
                {recipe.reason}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-1.5 lg:justify-end">
            <span className="badge bg-white text-slate-600">{recipe.cookingTime}</span>
            <span className="badge bg-white text-slate-600">{recipe.difficulty || '보통'}</span>
            <span className="badge bg-slate-900 text-white">{recipe.scoreLabel || `${recipe.score ?? '-'}점`}</span>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="soft-panel">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">추천 점수</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{recipe.scoreLabel || `${recipe.score ?? '-'}점`}</p>
            <p className="mt-1 text-xs muted">{`핵심 일치 ${Math.round((recipe.baseScore || 0) * 100)}%`}</p>
          </div>
          <div className="soft-panel border-brand-100/70 bg-brand-50/60">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">핵심 재료</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {recipe.matchedCount ?? matchedIngredients.length}/{totalCoreCount}
            </p>
            <p className="mt-1 line-clamp-2 text-xs muted">{joinIngredientLabels(matchedIngredients) || '아직 없어요'}</p>
          </div>
          <div className="soft-panel border-rose-100/80 bg-rose-50/70">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700">부족한 재료</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{recipe.missingCount ?? 0}</p>
            <p className="mt-1 line-clamp-2 text-xs muted">{joinIngredientLabels(missingIngredients) || '없음'}</p>
          </div>
        </div>

        <div className="grid gap-2 lg:grid-cols-3">
          <div className="soft-panel">
            <p className="text-sm font-semibold text-slate-900">핵심 재료</p>
            <p className="mt-1.5 text-sm leading-6 muted">{joinIngredientLabels(recipe.coreIngredients || recipe.ingredients || [])}</p>
          </div>

          <div className="soft-panel">
            <p className="text-sm font-semibold text-slate-900">선택 재료</p>
            <p className="mt-1.5 text-sm leading-6 muted">
              {recipe.optionalIngredients.length ? joinIngredientLabels(recipe.optionalIngredients) : '없음'}
            </p>
          </div>

          <div className="soft-panel">
            <p className="text-sm font-semibold text-slate-900">기본 양념 / 팬트리</p>
            <p className="mt-1.5 text-sm leading-6 muted">
              {recipe.pantryIngredients.length ? joinIngredientLabels(recipe.pantryIngredients) : '없음'}
            </p>
            {recipe.missingGroups?.length ? (
              <p className="mt-2 text-xs text-rose-700">{`${recipe.missingGroups.join(', ')} 조건이 아직 부족해요.`}</p>
            ) : null}
          </div>
        </div>

        {recipe.urgentMatches?.length ? (
          <div className="rounded-[18px] border border-amber-200/70 bg-amber-50/80 px-3.5 py-3">
            <p className="text-sm font-semibold text-amber-800">곧 써야 하는 재료</p>
            <p className="mt-1.5 text-sm leading-6 text-amber-900">{joinIngredientLabels(recipe.urgentMatches)}</p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default memo(RecipeCard);
