import { memo } from 'react';
import { Link } from 'react-router-dom';
import RecipeCard from './RecipeCard';

function SkeletonCard() {
  return (
    <div className="card min-h-[280px] min-w-[300px] flex-[0_0_300px] animate-pulse sm:min-w-[360px] sm:flex-[0_0_360px]">
      <div className="space-y-4">
        <div className="h-4 w-20 rounded-full bg-slate-200" />
        <div className="h-6 w-2/3 rounded-full bg-slate-200" />
        <div className="h-16 rounded-[16px] bg-slate-100" />
        <div className="grid grid-cols-3 gap-2">
          <div className="h-20 rounded-[16px] bg-slate-100" />
          <div className="h-20 rounded-[16px] bg-slate-100" />
          <div className="h-20 rounded-[16px] bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

function RecommendationRow({
  title,
  description,
  recipes = [],
  loading = false,
  error = '',
  hidden = false,
  needsLogin = false,
  emptyTitle = '추천할 레시피가 아직 없어요',
  emptyDescription = '재료를 조금 더 추가하면 추천 후보가 늘어납니다.',
  emptyActionLabel = '',
  emptyActionTo = '',
  loginCtaTo = '/login',
  onRecipeSelect,
  observeRef
}) {
  if (hidden) {
    return null;
  }

  return (
    <section ref={observeRef} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h3>
          {description ? <p className="mt-1 text-sm leading-6 muted">{description}</p> : null}
        </div>
        {recipes.length ? <span className="badge bg-white text-slate-500">{`레시피 ${recipes.length}개`}</span> : null}
      </div>

      {needsLogin ? (
        <div className="rounded-[16px] border border-dashed border-slate-200 bg-white/80 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-800">로그인하면 AI 추천을 볼 수 있어요</p>
            <Link to={loginCtaTo} className="btn-primary">
              로그인
            </Link>
          </div>
        </div>
      ) : null}

      {error ? <div className="rounded-[16px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      {!needsLogin && !error && loading ? (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {[0, 1, 2].map((item) => (
            <SkeletonCard key={item} />
          ))}
        </div>
      ) : null}

      {!needsLogin && !error && !loading && recipes.length ? (
        <div className="flex snap-x gap-3 overflow-x-auto pb-3">
          {recipes.map((recipe) => (
            <div key={recipe.id || recipe.recipeId || recipe.title} className="min-w-[300px] flex-[0_0_300px] snap-start sm:min-w-[380px] sm:flex-[0_0_380px]">
              <RecipeCard recipe={recipe} onSelect={onRecipeSelect} />
            </div>
          ))}
        </div>
      ) : null}

      {!needsLogin && !error && !loading && !recipes.length ? (
        <div className="rounded-3xl border border-dashed border-stone-100 bg-white/70 p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <div className="text-4xl leading-none" aria-hidden="true">
                🍳
              </div>
              <div>
                <p className="text-base font-semibold text-stone-800">{emptyTitle}</p>
                <p className="mt-1.5 text-sm leading-6 text-stone-500">{emptyDescription}</p>
              </div>
            </div>
            {emptyActionLabel && emptyActionTo ? (
              <Link
                to={emptyActionTo}
                className="inline-flex min-h-[2.5rem] items-center justify-center rounded-full bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700"
              >
                {emptyActionLabel}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default memo(RecommendationRow);
