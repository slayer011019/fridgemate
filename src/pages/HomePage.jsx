import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import { useAnalytics } from '../hooks/useAnalytics';
import { useHomePageModel } from '../hooks/useHomePageModel';
import { isOcrEnabled } from '../utils/backendConfig';
import { getCategoryLabel, getStorageLabel, joinIngredientLabels } from '../utils/displayText';
import { getExpiryLabel, getRemainingDays } from '../utils/date';

function HomePage() {
  const ocrEnabled = isOcrEnabled();
  const { trackEvent } = useAnalytics();
  const lastViewSignatureRef = useRef('');
  const { loading, summary, topRecommendations, upcomingItems, urgentCount } = useHomePageModel();
  const isEmptyDashboard = !loading && summary.total === 0 && urgentCount === 0 && topRecommendations.length === 0;
  const summaryItems = [
    {
      label: '\uC804\uCCB4 \uC7AC\uB8CC',
      value: loading ? '...' : isEmptyDashboard ? '--' : summary.total,
      className: 'border-green-100 bg-green-50/70'
    },
    {
      label: '\uC6B0\uC120 \uCC98\uB9AC',
      value: loading ? '...' : isEmptyDashboard ? '\uD655\uC778 \uC804' : urgentCount,
      className: 'border-amber-100 bg-amber-50/70'
    },
    {
      label: '\uC624\uB298 \uD560 \uC77C',
      value: loading ? '...' : isEmptyDashboard ? '\uC5C6\uC74C' : topRecommendations.length,
      className: 'border-rose-100 bg-rose-50/70'
    }
  ];

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
    <div className="section-shell mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-10">
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

      <section className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {summaryItems.map((item) => (
          <div key={item.label} className={`rounded-[22px] border px-4 py-4 text-center shadow-sm ${item.className}`}>
            <p className="text-2xl font-semibold leading-none text-stone-800">{item.value}</p>
            <p className="mt-1.5 text-[11px] font-semibold text-stone-500">{item.label}</p>
          </div>
        ))}
      </section>

      <section className="card space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="kicker">{'\uC624\uB298 \uBA3C\uC800 \uBCFC \uBAA9\uB85D'}</p>
            <h3 className="mt-1.5 text-lg font-semibold text-slate-900 sm:text-xl">{'\uC720\uD1B5\uAE30\uD55C \uC784\uBC15 \uB9AC\uC2A4\uD2B8'}</h3>
            <p className="mt-1.5 text-sm leading-5.5 muted">
              {'\uACE7 \uC368\uC57C \uD558\uB294 \uC7AC\uB8CC\uB97C \uC55E\uCABD\uC5D0 \uC815\uB82C\uD574 \uC18C\uBE44 \uC21C\uC11C\uB97C \uBE60\uB974\uAC8C \uC815\uD558\uAC8C \uD569\uB2C8\uB2E4.'}
            </p>
          </div>
          <Link to="/ingredients" className="btn-secondary">
            {'\uC804\uCCB4 \uC7AC\uB8CC \uBCF4\uAE30'}
          </Link>
        </div>

        <div className="content-grid-2 gap-2.5">
          {!loading && !upcomingItems.length ? (
            <EmptyState
              compact
              className="md:col-span-2"
              icon="🧺"
              title={'\uC544\uC9C1 \uC800\uC7A5\uB41C \uC7AC\uB8CC\uAC00 \uC5C6\uC5B4\uC694'}
              description={'\uCCAB \uC7AC\uB8CC\uB97C \uCD94\uAC00\uD558\uBA74 \uC720\uD1B5\uAE30\uD55C \uAD00\uB9AC\uC640 \uC74C\uC2DD\uBB3C \uB0AD\uBE44 \uC904\uC774\uAE30\uB97C \uBC14\uB85C \uC2DC\uC791\uD560 \uC218 \uC788\uC5B4\uC694.'}
              actionLabel={'\uCCAB \uC7AC\uB8CC \uCD94\uAC00\uD558\uAE30'}
              actionTo="/ingredients/new"
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

      <section className="card space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="kicker">{'\uC624\uB298 \uACE0\uB97C \uBA54\uB274'}</p>
            <h3 className="mt-1.5 text-lg font-semibold text-slate-900 sm:text-xl">{'\uCD94\uCC9C \uB808\uC2DC\uD53C \uBBF8\uB9AC\uBCF4\uAE30'}</h3>
            <p className="mt-1.5 text-sm leading-5.5 muted">
              {'\uBC14\uB85C \uD560 \uC218 \uC788\uB294 \uAC83\uBD80\uD130 \uBBF8\uB9AC \uBCF4\uACE0, \uC0C1\uC138 \uD310\uB2E8\uC740 \uB808\uC2DC\uD53C \uD398\uC774\uC9C0\uC5D0\uC11C \uC774\uC5B4\uAC00\uC138\uC694.'}
            </p>
          </div>
          <Link to="/recipes" className="btn-secondary">
            {'\uB808\uC2DC\uD53C \uCD94\uCC9C \uBCF4\uAE30'}
          </Link>
        </div>

        <div>
          {!loading && !topRecommendations.length ? (
            <EmptyState
              compact
              className="md:col-span-2 xl:col-span-3"
              icon="🍳"
              title={'\uC544\uC9C1 \uCD94\uCC9C \uAC00\uB2A5\uD55C \uB808\uC2DC\uD53C\uAC00 \uC5C6\uC5B4\uC694'}
              description={'\uBCF4\uC720 \uC911\uC778 \uC7AC\uB8CC\uB97C \uCD94\uAC00\uD558\uBA74 \uC5EC\uAE30\uC5D0 \uC798 \uB9DE\uB294 \uB808\uC2DC\uD53C\uAC00 \uB098\uD0C0\uB0A9\uB2C8\uB2E4.'}
              actionLabel={'\uC7AC\uB8CC \uB4F1\uB85D\uD558\uB7EC \uAC00\uAE30'}
              actionTo="/ingredients/new"
            />
          ) : null}

          <div className="content-grid-3">
            {topRecommendations.map((recipe) => (
              <article key={recipe.id} className="soft-panel">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-900">{recipe.title || recipe.name}</p>
                    <p className="mt-1 text-xs leading-5 muted">
                      {recipe.canMakeNow ? '\uC9C0\uAE08 \uAC00\uB2A5' : recipe.missingCore?.length === 1 ? '\uD558\uB098\uB9CC \uBD80\uC871' : '\uC7AC\uB8CC \uB9E4\uCE6D'}
                    </p>
                  </div>
                  <span className="badge bg-slate-900 text-white">{recipe.matchRateLabel || `${Math.round((recipe.matchRate || 0) * 100)}%`}</span>
                </div>
                <p className="mt-2 text-xs leading-5 muted">
                  {joinIngredientLabels(recipe.matchedIngredients || recipe.matchedCore || []) || '\uBCF4\uC720 \uC7AC\uB8CC\uB97C \uB354 \uCD94\uAC00\uD574\uBCF4\uC138\uC694'}
                </p>
                {recipe.missingCore?.length ? (
                  <p className="mt-1 text-xs leading-5 text-rose-700">{`\uBD80\uC871: ${joinIngredientLabels(recipe.missingCore)}`}</p>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
