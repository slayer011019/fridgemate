import { memo, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import RecipeCard from './RecipeCard';
import { saveRecommendationEvent } from '../api/recommendationEventsApi';

function getRecipeKey(recipe = {}) {
  return String(recipe.recipeId || recipe.id || recipe.sourceRecipeId || recipe.title || recipe.name || '').trim();
}

function SkeletonCard() {
  return (
    <div className="card min-h-[230px] min-w-[300px] flex-[0_0_300px] animate-pulse sm:min-w-[360px] sm:flex-[0_0_360px]">
      <div className="space-y-4">
        <div className="h-4 w-20 rounded-full bg-slate-200" />
        <div className="h-6 w-2/3 rounded-full bg-slate-200" />
        <div className="h-12 rounded-md bg-slate-100" />
        <div className="h-10 rounded-md bg-slate-100" />
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
  observeRef,
  source = ''
}) {
  const impressedRecipeIdsRef = useRef(new Set());
  const rankedRecipes = useMemo(
    () =>
      recipes.map((recipe, index) => ({
        ...recipe,
        _recommendationRank: index + 1,
        _recommendationSource: source || recipe._recommendationSource || null
      })),
    [recipes, source]
  );

  useEffect(() => {
    if (hidden || needsLogin || error || loading || !rankedRecipes.length) {
      return;
    }

    rankedRecipes.forEach((recipe) => {
      const recipeId = getRecipeKey(recipe);

      if (!recipeId || impressedRecipeIdsRef.current.has(recipeId)) {
        return;
      }

      impressedRecipeIdsRef.current.add(recipeId);
      saveRecommendationEvent(recipe, 'impression', {
        rank: recipe._recommendationRank,
        source: recipe._recommendationSource
      }).catch(() => {});
    });
  }, [error, hidden, loading, needsLogin, rankedRecipes]);

  const handleRecipeSelect = (recipe) => {
    saveRecommendationEvent(recipe, 'click', {
      rank: recipe._recommendationRank,
      source: recipe._recommendationSource
    }).catch(() => {});

    if (typeof onRecipeSelect === 'function') {
      onRecipeSelect(recipe);
    }
  };

  if (hidden) {
    return null;
  }

  return (
    <section ref={observeRef} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className={`border-l-4 pl-3 ${source === 'hybrid' ? 'border-l-cyan-500' : 'border-l-brand-500'}`}>
          <h2 className="text-lg font-bold text-slate-950 sm:text-xl">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 muted">{description}</p> : null}
        </div>
      {rankedRecipes.length ? <span className="badge bg-white text-slate-500">{`레시피 ${rankedRecipes.length}개`}</span> : null}
      </div>

      {needsLogin ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-800">로그인하면 AI 추천을 볼 수 있어요</p>
            <Link to={loginCtaTo} className="btn-primary">
              로그인
            </Link>
          </div>
        </div>
      ) : null}

      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div> : null}

      {!needsLogin && !error && loading ? (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {[0, 1, 2].map((item) => (
            <SkeletonCard key={item} />
          ))}
        </div>
      ) : null}

      {!needsLogin && !error && !loading && rankedRecipes.length ? (
        <div className="flex snap-x gap-3 overflow-x-auto pb-3">
          {rankedRecipes.map((recipe) => (
            <div key={recipe.id || recipe.recipeId || recipe.title} className="min-w-[300px] flex-[0_0_300px] snap-start sm:min-w-[380px] sm:flex-[0_0_380px]">
              <RecipeCard recipe={recipe} onSelect={handleRecipeSelect} />
            </div>
          ))}
        </div>
      ) : null}

      {!needsLogin && !error && !loading && !rankedRecipes.length ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 shadow-sm">
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
