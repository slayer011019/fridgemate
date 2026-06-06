import { useEffect, useRef } from 'react';
import PageHeader from '../components/PageHeader';
import PantryStaplesPanel from '../components/PantryStaplesPanel';
import RecommendationRow from '../components/RecommendationRow';
import StatCard from '../components/StatCard';
import { useAnalytics } from '../hooks/useAnalytics';
import { useDBRecommendations } from '../hooks/useDBRecommendations';
import { useRecipesPageModel } from '../hooks/useRecipesPageModel';

function RecipesPage() {
  const { trackEvent } = useAnalytics();
  const lastViewSignatureRef = useRef('');
  const {
    pantryStaples,
    pantryOwnership,
    pantrySummary,
    cyclePantryStatus,
    ownedPantryItems,
    loading,
    ingredients,
    summary,
    missingBasicIngredients,
    activeIngredientCount,
    localRecommendations,
    readyRecommendations,
    buyOneRecommendations,
    useSoonRecommendations,
    ownedPantryCount,
    fridgeInsight,
    sectionStats
  } = useRecipesPageModel();
  const recommendationEmptyMessage = !loading && activeIngredientCount === 0 ? '재료를 등록하면 추천을 시작할 수 있어요' : '';
  const dbRecommendationsState = useDBRecommendations({
    ingredients,
    pantryItems: ownedPantryItems
  });

  useEffect(() => {
    if (loading) {
      return;
    }

    const nextSignature = [activeIngredientCount, summary.expiringSoon, readyRecommendations.length, buyOneRecommendations.length, useSoonRecommendations.length].join(':');

    if (lastViewSignatureRef.current === nextSignature) {
      return;
    }

    lastViewSignatureRef.current = nextSignature;
    trackEvent('recommendations_viewed', {
      screen: 'recipes',
      available_ingredient_count: activeIngredientCount,
      expiring_soon_count: summary.expiringSoon,
      ready_count: readyRecommendations.length,
      buy_one_more_count: buyOneRecommendations.length,
      use_soon_count: useSoonRecommendations.length
    });
  }, [
    activeIngredientCount,
    buyOneRecommendations.length,
    loading,
    readyRecommendations.length,
    summary.expiringSoon,
    trackEvent,
    useSoonRecommendations.length
  ]);

  const handleRecommendationSelect = (group) => (recipe) => {
    trackEvent('recommendation_clicked', {
      screen: 'recipes',
      recipe_name: recipe.title,
      group,
      score: recipe.score ?? null,
      missing_core_count: recipe.missingCore?.length ?? recipe.missingIngredients?.length ?? recipe.missingCount ?? 0
    });
  };

  return (
    <div className="section-shell mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-10">
      <PageHeader
        eyebrow={'\uB808\uC2DC\uD53C'}
        title={'\uC9C0\uAE08 \uB9CC\uB4E4 \uC218 \uC788\uB294 \uBA54\uB274\uB97C \uBE60\uB974\uAC8C \uACE0\uB974\uC138\uC694'}
        description={
          '\uBC14\uB85C \uD560 \uC218 \uC788\uB294 \uAC83, \uD55C \uB450 \uAC1C \uB9CC \uB354 \uD544\uC694\uD55C \uAC83, \uBE68\uB9AC \uCC98\uB9AC\uD558\uBA74 \uC88B\uC740 \uAC83\uC73C\uB85C \uB098\uB220 \uBCF4\uC5EC\uC90D\uB2C8\uB2E4.'
        }
      />

      <section className="stats-grid">
        <StatCard
          label={'\uC9C0\uAE08 \uB9CC\uB4E4 \uC218 \uC788\uC5B4\uC694'}
          value={sectionStats.ready.value}
          helper={sectionStats.ready.helper}
          emptyMessage={recommendationEmptyMessage}
        />
        <StatCard
          label={'\uD558\uB098\uB9CC \uB354 \uC0AC\uBA74 \uB3FC\uC694'}
          value={sectionStats.buyOne.value}
          tone="warning"
          helper={sectionStats.buyOne.helper}
          emptyMessage={recommendationEmptyMessage}
        />
        <StatCard
          label={'\uBE68\uB9AC \uC368\uC57C \uD560 \uC7AC\uB8CC \uC911\uC2EC'}
          value={sectionStats.useSoon.value}
          tone="danger"
          helper={sectionStats.useSoon.helper}
          emptyMessage={recommendationEmptyMessage}
        />
      </section>

      <section className="card bg-gradient-to-br from-brand-50/80 via-white/55 to-amber-50/65">
        <div className="adaptive-split">
          <div className="space-y-3">
            <div>
              <p className="kicker">{'\uC9C0\uAE08 \uC0C1\uD0DC \uC694\uC57D'}</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">{'\uC9C0\uAE08 \uC7AC\uB8CC\uB85C \uBB34\uC5C7\uC744 \uD560 \uC218 \uC788\uB294\uC9C0 \uBCF4\uC5EC\uC918\uC694'}</h3>
            </div>
            <p className="text-sm leading-5.5 text-slate-700">{fridgeInsight}</p>
            {missingBasicIngredients.length ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {missingBasicIngredients.map((ingredient) => (
                  <span key={ingredient} className="badge bg-white text-slate-600">
                    {ingredient}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
            <div className="soft-panel">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{'\uD604\uC7AC \uB4F1\uB85D \uC7AC\uB8CC'}</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">{loading ? '...' : activeIngredientCount}</p>
              <p className="mt-1 text-xs muted">{'\uBCF4\uC720 \uC911\uC778 \uC7AC\uB8CC \uAE30\uC900'}</p>
            </div>
            <div className="soft-panel border-amber-100/70 bg-amber-50/70">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">{'\uC720\uD1B5\uAE30\uD55C \uC784\uBC15'}</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">{loading ? '...' : summary.expiringSoon}</p>
              <p className="mt-1 text-xs muted">{'\uC6B0\uC120 \uC18C\uBE44\uD558\uBA74 \uC88B\uC740 \uC7AC\uB8CC'}</p>
            </div>
            <div className="soft-panel border-brand-100/70 bg-white/80">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">{'\uCD94\uCC9C \uD3ED \uB113\uD788\uAE30'}</p>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-900">
                {missingBasicIngredients.length
                  ? `${missingBasicIngredients.slice(0, 3).join(', ')}\uC744 \uCC44\uC6B0\uBA74 \uCD94\uCC9C\uC774 \uB354 \uB2E4\uC591\uD574\uC838\uC694.`
                  : '\uAE30\uBCF8 \uC7AC\uB8CC\uB294 \uC5B4\uB290 \uC815\uB3C4 \uAC16\uCD94\uC838 \uC788\uC5B4\uC694.'}
              </p>
              <p className="mt-2 text-xs muted">{`\uD32C\uD2B8\uB9AC \uBCF4\uC720 \uC124\uC815 ${ownedPantryCount}\uAC1C`}</p>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <PantryStaplesPanel
            items={pantryStaples}
            pantryOwnership={pantryOwnership}
            pantrySummary={pantrySummary}
            onCycle={cyclePantryStatus}
          />
        </div>
      </section>

      <RecommendationRow
        title={'재료 기반 추천'}
        description={'현재 재료와 팬트리 기본 재료를 기존 로컬 점수 계산으로 정렬했어요.'}
        recipes={localRecommendations}
        loading={loading}
        source="rule"
        onRecipeSelect={handleRecommendationSelect('local')}
        emptyTitle={'아직 추천할 레시피가 없어요'}
        emptyDescription={
          missingBasicIngredients.length
            ? `${missingBasicIngredients.slice(0, 3).join(', ')} 같은 기본 재료를 추가하면 추천 폭이 넓어져요.`
            : '재료를 추가하면 바로 만들 수 있는 메뉴를 정리해드릴게요.'
        }
        emptyActionLabel={'재료 등록하러 가기'}
        emptyActionTo="/ingredients/new"
      />

      <RecommendationRow
        title={'AI 추천'}
        description={'DB 레시피 카탈로그에서 현재 재료와 비슷한 후보를 찾아 보여줘요.'}
        recipes={dbRecommendationsState.recommendations}
        loading={dbRecommendationsState.loading}
        error={dbRecommendationsState.error}
        hidden={dbRecommendationsState.hidden}
        needsLogin={dbRecommendationsState.needsLogin}
        observeRef={dbRecommendationsState.rowRef}
        source="hybrid"
        onRecipeSelect={handleRecommendationSelect('ai')}
        emptyTitle={'AI 추천 후보가 아직 없어요'}
        emptyDescription={'DB 레시피 카탈로그에 매칭되는 후보가 생기면 이 행에 표시됩니다.'}
        emptyActionLabel={'재료 등록하러 가기'}
        emptyActionTo="/ingredients/new"
      />
    </div>
  );
}

export default RecipesPage;
