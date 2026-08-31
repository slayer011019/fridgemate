import { memo } from 'react';
import RecipeExternalLinks from './RecipeExternalLinks';
import { joinIngredientLabels } from '../utils/displayText';

function RecipeCard({ recipe, isSelected = false, onDismiss, onExternalOpen, onSelect }) {
  const recipeName = recipe.title || recipe.name || '';
  const matchedIngredients = recipe.matchedIngredients || recipe.matchedCore || [];
  const missingIngredients = recipe.missingIngredients || recipe.missingCore || [];
  const missingSeasonings = recipe.missingSeasonings || [];
  const coreIngredients = recipe.coreIngredients || recipe.ingredients || [];
  const hasMissingItems = missingIngredients.length > 0 || missingSeasonings.length > 0 || recipe.missingGroups?.length > 0;
  return (
    <article
      className={`card overflow-hidden border-l-4 ${isSelected ? 'border-l-emerald-600 ring-2 ring-emerald-100' : 'border-l-brand-500'}`}
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {recipe.category ? <p className="kicker">{recipe.category}</p> : null}
              {recipe.useSoon ? <span className="badge border border-amber-200 bg-amber-50 text-amber-800">먼저 쓸 재료</span> : null}
              {recipe.canMakeNow ? <span className="badge border border-emerald-200 bg-emerald-50 text-emerald-800">바로 가능</span> : null}
              {isSelected ? <span className="badge border border-emerald-200 bg-emerald-50 text-emerald-800">오늘 메뉴</span> : null}
            </div>
            <h3 className="text-lg font-semibold text-slate-900">{recipeName}</h3>
            {recipe.reason ? (
              <p className="border-l-2 border-brand-500 pl-3 text-sm font-medium leading-6 text-brand-900">
                {recipe.reason}
              </p>
            ) : null}
            {recipe.description ? <p className="line-clamp-2 text-sm leading-6 muted">{recipe.description}</p> : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
            {recipe.cookingMethod ? <span className="badge bg-white text-slate-600">{recipe.cookingMethod}</span> : null}
            <div className="flex items-baseline gap-1 rounded-md bg-slate-900 px-3 py-2 text-white">
              <span className="text-lg font-bold leading-none">{recipe.matchRateLabel || `${Math.round((recipe.matchRate || 0) * 100)}%`}</span>
              <span className="text-[11px] text-slate-300">매칭</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-700">
          <span className="font-semibold text-slate-900">보유 재료</span>
          <span>{joinIngredientLabels(matchedIngredients) || '아직 없어요'}</span>
          <span className="text-xs text-slate-500">
            {`${recipe.matchedCount ?? matchedIngredients.length}/${recipe.totalRequiredIngredients ?? coreIngredients.length}개 일치`}
          </span>
        </div>

        {hasMissingItems ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
            <p className="font-semibold">추가로 필요한 재료</p>
            {missingIngredients.length ? <p className="mt-1 leading-6">{joinIngredientLabels(missingIngredients)}</p> : null}
            {missingSeasonings.length ? <p className="mt-1 text-xs leading-5 text-amber-800">{`양념: ${joinIngredientLabels(missingSeasonings)}`}</p> : null}
            {recipe.missingGroups?.length ? (
              <p className="mt-1 text-xs leading-5 text-amber-800">{`${recipe.missingGroups.join(', ')} 조건이 더 필요해요`}</p>
            ) : null}
          </div>
        ) : null}

        {recipe.expiringMatchedIngredients?.length ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5">
            <p className="text-sm font-semibold text-rose-800">{`먼저 사용: ${joinIngredientLabels(recipe.expiringMatchedIngredients)}`}</p>
          </div>
        ) : null}

        {coreIngredients.length ? (
          <details className="text-sm text-slate-600">
            <summary className="cursor-pointer font-medium text-slate-700">주요 재료 보기</summary>
            <p className="mt-2 leading-6">{joinIngredientLabels(coreIngredients)}</p>
          </details>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-slate-200/80 pt-3">
          <button
            className="btn-primary"
            disabled={isSelected}
            onClick={() => onSelect?.(recipe)}
            type="button"
          >
            {isSelected ? '선택됨' : '오늘 먹기'}
          </button>
          <button className="btn-secondary" onClick={() => onDismiss?.(recipe)} type="button">
            관심 없음
          </button>
        </div>

        <RecipeExternalLinks
          recipeName={recipeName}
          searchLinks={recipe.searchLinks}
          onOpen={(provider) => onExternalOpen?.(recipe, provider)}
        />
      </div>
    </article>
  );
}

export default memo(RecipeCard);
