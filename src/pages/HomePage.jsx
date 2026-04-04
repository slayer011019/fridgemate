import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import RecipeCard from '../components/RecipeCard';
import StatCard from '../components/StatCard';
import { seedRecipes } from '../data/seedRecipes';
import { getUpcomingIngredients } from '../features/ingredients/ingredientSelectors';
import { useIngredients } from '../hooks/useIngredients';
import { usePantryStaples } from '../hooks/usePantryStaples';
import { isOcrEnabled } from '../utils/backendConfig';
import { getCategoryLabel, getStorageLabel } from '../utils/displayText';
import { getDashboardSummary, getExpiryLabel, getRemainingDays } from '../utils/date';
import { getTopRecommendations } from '../utils/recommendations';

function HomePage() {
  const { ingredients, loading } = useIngredients();
  const { pantryOwnership } = usePantryStaples();
  const ocrEnabled = isOcrEnabled();
  const summary = useMemo(() => getDashboardSummary(ingredients), [ingredients]);
  const topRecommendations = useMemo(
    () => getTopRecommendations(seedRecipes, ingredients, 3, { pantryOwnership }),
    [ingredients, pantryOwnership]
  );
  const upcomingItems = useMemo(() => getUpcomingIngredients(ingredients, 4), [ingredients]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={'\uB300\uC2DC\uBCF4\uB4DC'}
        title={'\uC624\uB298\uC758 \uB0C9\uC7A5\uACE0\uB97C \uC0B0\uB73B\uD558\uAC8C \uC815\uB9AC\uD574\uBCFC\uAE4C\uC694?'}
        description={
          '\uB0C9\uC7A5\uACE0 \uC18D \uC7AC\uB8CC \uD604\uD669\uACFC \uC720\uD1B5\uAE30\uD55C \uC704\uD5D8, \uADF8\uB9AC\uACE0 \uC9C0\uAE08 \uB9CC\uB4E4 \uC218 \uC788\uB294 \uB808\uC2DC\uD53C\uAE4C\uC9C0 \uD558\uB098\uC758 \uD750\uB984\uC73C\uB85C \uBCF4\uC5EC\uC90D\uB2C8\uB2E4.'
        }
        action={
          <>
            {ocrEnabled ? (
              <Link to="/import" className="btn-secondary">
                {'\uC2A4\uD06C\uB9B0\uC0F7 \uBD88\uB7EC\uC624\uAE30'}
              </Link>
            ) : null}
            <Link to="/ingredients/new" className="btn-primary">
              {'\uC7AC\uB8CC \uCD94\uAC00'}
            </Link>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label={'\uC804\uCCB4 \uC7AC\uB8CC'} value={loading ? '...' : summary.total} />
        <StatCard label={'\uACE7 \uB9CC\uB8CC'} value={loading ? '...' : summary.expiringSoon} tone="warning" />
        <StatCard label={'\uC774\uBBF8 \uC9C0\uB0A8'} value={loading ? '...' : summary.expired} tone="danger" />
      </section>

      <section className="card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="kicker">{'\uBA3C\uC800 \uC368\uC57C \uD560 \uC7AC\uB8CC'}</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">{'\uC720\uD1B5\uAE30\uD55C \uC784\uBC15 \uB9AC\uC2A4\uD2B8'}</h3>
            <p className="mt-2 text-sm leading-6 muted">{'\uB2F9\uC7A5 \uC18C\uBE44\uD558\uBA74 \uC88B\uC740 \uC7AC\uB8CC\uB97C \uBA3C\uC800 \uBCF4\uC5EC\uC918 \uC7A5\uBCF4\uAE30\uC640 \uC694\uB9AC \uC21C\uC11C\uB97C \uC815\uB9AC\uD574\uC90D\uB2C8\uB2E4.'}</p>
          </div>
          <Link to="/ingredients" className="btn-secondary">
            {'\uC804\uCCB4 \uC7AC\uB8CC \uBCF4\uAE30'}
          </Link>
        </div>

        <div className="mt-5 grid gap-3">
          {!loading && !upcomingItems.length ? (
            <EmptyState
              title={'\uC544\uC9C1 \uC800\uC7A5\uB41C \uC7AC\uB8CC\uAC00 \uC5C6\uC5B4\uC694'}
              description={'\uCCAB \uC7AC\uB8CC\uB97C \uCD94\uAC00\uD558\uBA74 \uC720\uD1B5\uAE30\uD55C \uAD00\uB9AC\uC640 \uC74C\uC2DD\uBB3C \uB0AD\uBE44 \uC904\uC774\uAE30\uB97C \uBC14\uB85C \uC2DC\uC791\uD560 \uC218 \uC788\uC5B4\uC694.'}
            />
          ) : null}

          {upcomingItems.map((ingredient) => (
            <div key={ingredient.id} className="soft-panel flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-900">{ingredient.name}</p>
                <p className="mt-1 text-sm muted">
                  {`${getCategoryLabel(ingredient.category)} / ${getStorageLabel(ingredient.storageType)} / \uC720\uD1B5\uAE30\uD55C ${ingredient.expiryDate || '-'}`}
                </p>
              </div>
              <span className="badge bg-white text-slate-700">{getExpiryLabel(getRemainingDays(ingredient.expiryDate))}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="kicker">{'\uC624\uB298\uC758 \uC694\uB9AC \uD78C\uD2B8'}</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">{'\uCD94\uCC9C \uB808\uC2DC\uD53C \uBBF8\uB9AC\uBCF4\uAE30'}</h3>
            <p className="mt-2 text-sm leading-6 muted">{'\uC7AC\uB8CC \uBAA9\uB85D\uC774 \uBC14\uB00C\uBA74 \uCD94\uCC9C \uACB0\uACFC\uB3C4 \uC790\uB3D9\uC73C\uB85C \uD568\uAED8 \uC5C5\uB370\uC774\uD2B8\uB429\uB2C8\uB2E4.'}</p>
          </div>
          <Link to="/recipes" className="btn-secondary">
            {'\uB808\uC2DC\uD53C \uCD94\uCC9C \uBCF4\uAE30'}
          </Link>
        </div>

        <div className="mt-5">
          {!loading && !topRecommendations.length ? (
            <EmptyState
              title={'\uC544\uC9C1 \uCD94\uCC9C \uAC00\uB2A5\uD55C \uB808\uC2DC\uD53C\uAC00 \uC5C6\uC5B4\uC694'}
              description={'\uBCF4\uC720 \uC911\uC778 \uC7AC\uB8CC\uB97C \uCD94\uAC00\uD558\uBA74 \uC5EC\uAE30\uC5D0 \uC798 \uB9DE\uB294 \uB808\uC2DC\uD53C\uAC00 \uB098\uD0C0\uB0A9\uB2C8\uB2E4.'}
            />
          ) : null}

          <div className="grid gap-4 lg:grid-cols-3">
            {topRecommendations.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
