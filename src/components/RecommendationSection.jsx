import { memo } from 'react';
import { Link } from 'react-router-dom';
import RecipeCard from './RecipeCard';

function RecommendationSection({
  title,
  description,
  recipes,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  emptyActionTo,
  secondaryActionLabel,
  secondaryActionTo,
  suggestedIngredients = []
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h3>
          <p className="mt-1 text-sm leading-6 muted">{description}</p>
        </div>
        {recipes.length ? <span className="badge bg-white text-slate-500">{`\uB808\uC2DC\uD53C ${recipes.length}\uAC1C`}</span> : null}
      </div>

      {!recipes.length ? (
        <div className="rounded-[20px] border border-dashed border-slate-200 bg-white/70 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1.5">
              <p className="text-base font-semibold text-slate-900">{emptyTitle}</p>
              <p className="text-sm leading-6 muted">{emptyDescription}</p>
              {suggestedIngredients.length ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {suggestedIngredients.map((ingredient) => (
                    <span key={ingredient} className="badge bg-slate-100 text-slate-600">
                      {ingredient}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {emptyActionLabel && emptyActionTo ? (
                <Link to={emptyActionTo} className="btn-primary">
                  {emptyActionLabel}
                </Link>
              ) : null}
              {secondaryActionLabel && secondaryActionTo ? (
                <Link to={secondaryActionTo} className="btn-secondary">
                  {secondaryActionLabel}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
    </section>
  );
}

export default memo(RecommendationSection);
