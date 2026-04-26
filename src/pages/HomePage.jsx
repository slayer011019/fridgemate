import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import RecipeCard from '../components/RecipeCard';
import StatCard from '../components/StatCard';
import { useAnalytics } from '../hooks/useAnalytics';
import { useHomePageModel } from '../hooks/useHomePageModel';
import { isOcrEnabled } from '../utils/backendConfig';
import { getCategoryLabel, getStorageLabel } from '../utils/displayText';
import { getExpiryLabel, getRemainingDays } from '../utils/date';

function HomePage() {
  const ocrEnabled = isOcrEnabled();
  const { trackEvent } = useAnalytics();
  const lastViewSignatureRef = useRef('');
  const { loading, summary, topRecommendations, upcomingItems, urgentCount } = useHomePageModel();

  useEffect(() => {
    if (loading) {
      return;
    }

    const nextSignature = [summary.total, urgentCount, topRecommendations.length].join(':');

    if (lastViewSignatureRef.current === nextSignature) {
      return;
    }

    lastViewSignatureRef.current = nextSignature;
    trackEvent('recommendations_viewed', {
      screen: 'home',
      available_ingredient_count: summary.total,
      expiring_soon_count: urgentCount,
      ready_count: topRecommendations.length,
      buy_one_more_count: 0,
      use_soon_count: 0
    });
  }, [loading, summary.total, topRecommendations.length, trackEvent, urgentCount]);

  return (
    <div className="section-shell">
      <PageHeader
        eyebrow={'\uB300\uC2DC\uBCF4\uB4DC'}
        title={'\uC624\uB298 \uCC98\uB9AC\uD560 \uC7AC\uB8CC\uC640 \uB9CC\uB4E4 \uC218 \uC788\uB294 \uBA54\uB274\uB97C \uD55C\uBC88\uC5D0 \uBCF4\uC138\uC694'}
        description={
          '\uC720\uD1B5\uAE30\uD55C \uC784\uBC15, \uC7AC\uB8CC \uCD94\uAC00, \uCD94\uCC9C \uD655\uC778\uAE4C\uC9C0 \uC790\uC8FC \uD558\uB294 \uC791\uC5C5\uB9CC \uC55E\uCABD\uC5D0 \uBAA8\uC544\uB450\uC5C8\uC5B4\uC694.'
        }
        action={
          <>
            {ocrEnabled ? (
              <Link to="/import" className="btn-secondary">
                {'\uC0AC\uC9C4 \uAC00\uC838\uC624\uAE30'}
              </Link>
            ) : null}
            <Link to="/ingredients/new" className="btn-primary">
              {'\uC7AC\uB8CC \uCD94\uAC00'}
            </Link>
          </>
        }
      />

      <section className="stats-grid">
        <StatCard
          label={'\uC804\uCCB4 \uC7AC\uB8CC'}
          value={loading ? '...' : summary.total}
          helper={'\uD604\uC7AC \uBCF4\uC720 \uC911\uC778 \uD56D\uBAA9 \uAE30\uC900'}
        />
        <StatCard
          label={'\uC6B0\uC120 \uCC98\uB9AC'}
          value={loading ? '...' : urgentCount}
          tone="warning"
          helper={'\uACE7 \uB9CC\uB8CC + \uC774\uBBF8 \uC9C0\uB09C \uD56D\uBAA9'}
        />
        <StatCard
          label={'\uC624\uB298 \uD560 \uC77C'}
          value={loading ? '...' : topRecommendations.length}
          tone="default"
          helper={'\uBC14\uB85C \uBCFC \uB9CC\uD55C \uCD94\uCC9C \uBA54\uB274'}
        />
      </section>

      <section className="card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="kicker">{'\uC624\uB298 \uBA3C\uC800 \uBCFC \uBAA9\uB85D'}</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">{'\uC720\uD1B5\uAE30\uD55C \uC784\uBC15 \uB9AC\uC2A4\uD2B8'}</h3>
            <p className="mt-2 text-sm leading-5.5 muted">
              {'\uACE7 \uC368\uC57C \uD558\uB294 \uC7AC\uB8CC\uB97C \uC55E\uCABD\uC5D0 \uC815\uB82C\uD574 \uC18C\uBE44 \uC21C\uC11C\uB97C \uBE60\uB974\uAC8C \uC815\uD558\uAC8C \uD569\uB2C8\uB2E4.'}
            </p>
          </div>
          <Link to="/ingredients" className="btn-secondary">
            {'\uC804\uCCB4 \uC7AC\uB8CC \uBCF4\uAE30'}
          </Link>
        </div>

        <div className="content-grid-2 mt-4 gap-2.5">
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="kicker">{'\uC624\uB298 \uACE0\uB97C \uBA54\uB274'}</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">{'\uCD94\uCC9C \uB808\uC2DC\uD53C \uBBF8\uB9AC\uBCF4\uAE30'}</h3>
            <p className="mt-2 text-sm leading-5.5 muted">
              {'\uBC14\uB85C \uD560 \uC218 \uC788\uB294 \uAC83\uBD80\uD130 \uBBF8\uB9AC \uBCF4\uACE0, \uC0C1\uC138 \uD310\uB2E8\uC740 \uB808\uC2DC\uD53C \uD398\uC774\uC9C0\uC5D0\uC11C \uC774\uC5B4\uAC00\uC138\uC694.'}
            </p>
          </div>
          <Link to="/recipes" className="btn-secondary">
            {'\uB808\uC2DC\uD53C \uCD94\uCC9C \uBCF4\uAE30'}
          </Link>
        </div>

        <div className="mt-4">
          {!loading && !topRecommendations.length ? (
            <EmptyState
              title={'\uC544\uC9C1 \uCD94\uCC9C \uAC00\uB2A5\uD55C \uB808\uC2DC\uD53C\uAC00 \uC5C6\uC5B4\uC694'}
              description={'\uBCF4\uC720 \uC911\uC778 \uC7AC\uB8CC\uB97C \uCD94\uAC00\uD558\uBA74 \uC5EC\uAE30\uC5D0 \uC798 \uB9DE\uB294 \uB808\uC2DC\uD53C\uAC00 \uB098\uD0C0\uB0A9\uB2C8\uB2E4.'}
            />
          ) : null}

          <div className="content-grid-3">
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
