import { memo } from 'react';
import RecipeExternalLinks from './RecipeExternalLinks';
import { joinIngredientLabels } from '../utils/displayText';

function RecipeCard({ recipe, onSelect }) {
  const recipeName = recipe.title || recipe.name || '';
  const matchedIngredients = recipe.matchedIngredients || recipe.matchedCore || [];
  const missingIngredients = recipe.missingIngredients || recipe.missingCore || [];
  const missingSeasonings = recipe.missingSeasonings || [];
  const isInteractive = typeof onSelect === 'function';

  const handleKeyDown = (event) => {
    if (!isInteractive) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(recipe);
    }
  };

  return (
    <article
      className={`card overflow-hidden ${isInteractive ? 'cursor-pointer' : ''}`}
      onClick={isInteractive ? () => onSelect(recipe) : undefined}
      onKeyDown={handleKeyDown}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {recipe.category ? <p className="kicker">{recipe.category}</p> : null}
              {recipe.useSoon ? <span className="badge bg-amber-100 text-amber-800">빨리 써야 해요</span> : null}
              {recipe.canMakeNow ? <span className="badge bg-brand-50 text-brand-700">지금 가능</span> : null}
            </div>
            <h3 className="text-lg font-semibold text-slate-900">{recipeName}</h3>
            {recipe.reason ? (
              <div className="rounded-[16px] border border-brand-100/80 bg-brand-50/70 px-3 py-2 text-sm text-brand-900">
                {recipe.reason}
              </div>
            ) : null}
            {recipe.description ? <p className="text-sm leading-6 muted">{recipe.description}</p> : null}
          </div>

          <div className="flex flex-wrap gap-1.5 lg:justify-end">
            {recipe.cookingMethod ? <span className="badge bg-white text-slate-600">{recipe.cookingMethod}</span> : null}
            <span className="badge bg-slate-900 text-white">{recipe.matchRateLabel || `${Math.round((recipe.matchRate || 0) * 100)}%`}</span>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="soft-panel border-brand-100/70 bg-brand-50/60">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">매칭률</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {recipe.matchRateLabel || `${Math.round((recipe.matchRate || 0) * 100)}%`}
            </p>
            <p className="mt-1 text-xs muted">
              핵심 재료 {recipe.matchedCount ?? matchedIngredients.length}/{recipe.totalRequiredIngredients ?? 0}
            </p>
          </div>
          <div className="soft-panel">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">보유한 재료</p>
            <p className="mt-2 text-sm leading-6 text-slate-900">{joinIngredientLabels(matchedIngredients) || '아직 없어요'}</p>
          </div>
          <div className="soft-panel border-rose-100/80 bg-rose-50/70">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700">부족한 재료</p>
            <p className="mt-2 text-sm leading-6 text-slate-900">{joinIngredientLabels(missingIngredients) || '없음'}</p>
          </div>
        </div>

        <div className="grid gap-2 lg:grid-cols-2">
          <div className="soft-panel">
            <p className="text-sm font-semibold text-slate-900">부족한 양념</p>
            <p className="mt-1.5 text-sm leading-6 muted">{joinIngredientLabels(missingSeasonings) || '없음'}</p>
          </div>

          <div className="soft-panel">
            <p className="text-sm font-semibold text-slate-900">핵심 재료</p>
            <p className="mt-1.5 text-sm leading-6 muted">{joinIngredientLabels(recipe.coreIngredients || recipe.ingredients || [])}</p>
            {recipe.missingGroups?.length ? (
              <p className="mt-2 text-xs text-rose-700">{`${recipe.missingGroups.join(', ')} 조건은 아직 부족해요`}</p>
            ) : null}
          </div>
        </div>

        {recipe.expiringMatchedIngredients?.length ? (
          <div className="rounded-[18px] border border-amber-200/70 bg-amber-50/80 px-3.5 py-3">
            <p className="text-sm font-semibold text-amber-800">곧 써야 하는 재료</p>
            <p className="mt-1.5 text-sm leading-6 text-amber-900">{joinIngredientLabels(recipe.expiringMatchedIngredients)}</p>
          </div>
        ) : null}

        <RecipeExternalLinks recipeName={recipeName} searchLinks={recipe.searchLinks} />
      </div>
    </article>
  );
}

export default memo(RecipeCard);
