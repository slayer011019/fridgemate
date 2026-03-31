import PageHeader from '../components/PageHeader';
import RecommendationSection from '../components/RecommendationSection';
import StatCard from '../components/StatCard';
import { seedRecipes } from '../data/seedRecipes';
import { useIngredients } from '../hooks/useIngredients';
import { buildRecipeRecommendations } from '../utils/recommendations';

function RecipesPage() {
  const { ingredients, loading } = useIngredients();
  const recommendations = buildRecipeRecommendations(seedRecipes, ingredients);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={'\uB808\uC2DC\uD53C'}
        title={'\uC9C0\uAE08 \uAC00\uC9C4 \uC7AC\uB8CC\uB85C \uB9CC\uB4E4 \uC218 \uC788\uB294 \uD55C \uB07C\uB97C \uCC3E\uC544\uBCF4\uC138\uC694'}
        description={
          '\uBCF4\uC720 \uC7AC\uB8CC \uAE30\uBC18 \uC77C\uCE58\uC728\uC5D0 \uAC00\uC0B0\uC810\uC744 \uB354\uD574 \uCD94\uCC9C\uD574\uC11C, \uBB34\uC5C7\uC744 \uC9C0\uAE08 \uD574\uBA39\uC73C\uBA74 \uC88B\uC744\uC9C0 \uBC14\uB85C \uD310\uB2E8\uD560 \uC218 \uC788\uAC8C \uAD6C\uC131\uD588\uC2B5\uB2C8\uB2E4.'
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label={'\uC9C0\uAE08 \uB9CC\uB4E4 \uC218 \uC788\uC5B4\uC694'} value={loading ? '...' : recommendations.ready.length} />
        <StatCard label={'\uD558\uB098\uB9CC \uB354 \uC0AC\uBA74 \uB3FC\uC694'} value={loading ? '...' : recommendations.buyOne.length} tone="warning" />
        <StatCard label={'\uADF8 \uC678 \uBE44\uC2B7\uD55C \uB808\uC2DC\uD53C'} value={loading ? '...' : recommendations.other.length} tone="danger" />
      </section>

      <section className="card bg-gradient-to-br from-brand-50/80 via-white/50 to-amber-50/70">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="kicker">{'\uCD94\uCC9C \uAE30\uC900'}</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">{'\uB2E8\uC815\uD558\uACE0 \uC774\uD574\uD558\uAE30 \uC26C\uC6B4 \uC810\uC218 \uBC29\uC2DD'}</h3>
          </div>
          <p className="max-w-2xl text-sm leading-6 muted">
            {'\uD544\uC218 \uC7AC\uB8CC \uC77C\uCE58 \uBE44\uC728\uC744 \uAE30\uBCF8\uC73C\uB85C \uBCF4\uACE0, \uC720\uD1B5\uAE30\uD55C\uC774 \uC784\uBC15\uD55C \uC7AC\uB8CC\uB97C \uD65C\uC6A9\uD558\uAC70\uB098 \uBC14\uB85C \uB9CC\uB4E4 \uC218 \uC788\uC744\uC218\uB85D \uC810\uC218\uAC00 \uC62C\uB77C\uAC11\uB2C8\uB2E4.'}
          </p>
        </div>
      </section>

      <RecommendationSection
        title={'\uC9C0\uAE08 \uB9CC\uB4E4 \uC218 \uC788\uC5B4\uC694'}
        description={'\uD544\uC218 \uC7AC\uB8CC\uAC00 \uBAA8\uB450 \uB9DE\uB294 \uB808\uC2DC\uD53C\uC608\uC694. \uC624\uB298 \uBC14\uB85C \uD574\uBA39\uAE30 \uC88B\uC544\uC694.'}
        recipes={recommendations.ready}
        emptyTitle={'\uC544\uC9C1 \uBC14\uB85C \uB9CC\uB4E4 \uC218 \uC788\uB294 \uB808\uC2DC\uD53C\uAC00 \uC5C6\uC5B4\uC694'}
        emptyDescription={'\uC7AC\uB8CC\uB97C \uC870\uAE08 \uB354 \uCD94\uAC00\uD558\uAC70\uB098 \uAE30\uBCF8 \uC7AC\uB8CC\uB97C \uCC44\uC6B0\uBA74 \uC774 \uC601\uC5ED\uC774 \uAE08\uBC29 \uCC44\uC6CC\uC838\uC694.'}
      />

      <RecommendationSection
        title={'\uD558\uB098\uB9CC \uB354 \uC0AC\uBA74 \uB3FC\uC694'}
        description={'\uD544\uC218 \uC7AC\uB8CC\uAC00 \uB531 1\uAC1C\uB9CC \uBD80\uC871\uD55C \uAC70\uC758 \uC644\uC131 \uC0C1\uD0DC\uC758 \uB808\uC2DC\uD53C\uB4E4\uC785\uB2C8\uB2E4.'}
        recipes={recommendations.buyOne}
        emptyTitle={'\uC9C0\uAE08\uC740 \uD55C \uAC1C \uBD80\uC871\uD55C \uB808\uC2DC\uD53C\uAC00 \uC5C6\uC5B4\uC694'}
        emptyDescription={'\uC7AC\uB8CC \uBAA9\uB85D\uC774 \uB354 \uC313\uC774\uBA74 \uC7A5\uBCF4\uAE30 \uD6A8\uC728\uC774 \uC88B\uC740 \uD6C4\uBCF4\uAC00 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uB098\uD0C0\uB0A9\uB2C8\uB2E4.'}
      />

      <RecommendationSection
        title={'\uADF8 \uC678 \uAC00\uAE4C\uC6B4 \uD6C4\uBCF4'}
        description={'\uC77C\uBD80 \uC7AC\uB8CC\uAC00 \uC774\uBBF8 \uB9DE\uB294 \uB808\uC2DC\uD53C\uC608\uC694. \uB2E4\uC74C \uC7A5\uBCF4\uAE30 \uCC38\uACE0\uC6A9\uC73C\uB85C \uC88B\uC544\uC694.'}
        recipes={recommendations.other}
        emptyTitle={'\uC544\uC9C1 \uBE44\uC2B7\uD55C \uB808\uC2DC\uD53C\uB97C \uCC3E\uC9C0 \uBABB\uD588\uC5B4\uC694'}
        emptyDescription={'\uAE30\uBCF8 \uC7AC\uB8CC\uB97C \uBA87 \uAC00\uC9C0 \uB354 \uCD94\uAC00\uD558\uBA74 \uCD94\uCC9C \uD3ED\uC774 \uD6E8\uC52C \uB113\uC5B4\uC9D1\uB2C8\uB2E4.'}
      />
    </div>
  );
}

export default RecipesPage;
