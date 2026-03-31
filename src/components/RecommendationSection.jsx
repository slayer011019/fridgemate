import EmptyState from './EmptyState';
import RecipeCard from './RecipeCard';

function RecommendationSection({ title, description, recipes, emptyTitle, emptyDescription }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-2xl font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm leading-6 muted">{description}</p>
        </div>
        <span className="badge bg-white text-slate-600">{`\uB808\uC2DC\uD53C ${recipes.length}\uAC1C`}</span>
      </div>

      {!recipes.length ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
    </section>
  );
}

export default RecommendationSection;
