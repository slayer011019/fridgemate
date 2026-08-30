import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import PantryStaplesPanel from '../components/PantryStaplesPanel';
import RecommendationRow from '../components/RecommendationRow';
import StatCard from '../components/StatCard';
import AdSenseSlot from '../components/ads/AdSenseSlot';
import { useAnalytics } from '../hooks/useAnalytics';
import { useDBRecommendations } from '../hooks/useDBRecommendations';
import { useRecipesPageModel } from '../hooks/useRecipesPageModel';
import { isExternalAiUiEnabled } from '../api/externalAiRequest';
import { getPublicRecipePath, publicRecipeCatalog } from '../features/recipes/publicRecipeCatalog';
import {
  getPublicRecipeLinkItems,
  guidePages,
  ingredientHubs
} from '../features/recipes/recipeContentHubs';

const publicRecipeLinksByDishType = Object.entries(
  getPublicRecipeLinkItems().reduce((groups, recipe) => {
    groups[recipe.dishType] = [...(groups[recipe.dishType] || []), recipe];
    return groups;
  }, {})
).sort(([first], [second]) => first.localeCompare(second, 'ko'));

function RecipesPage() {
  const { trackEvent } = useAnalytics();
  const lastViewSignatureRef = useRef('');
  const [externalAiConsent, setExternalAiConsent] = useState(false);
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

  const handleExternalAiRequest = async () => {
    if (!externalAiConsent) return;
    setExternalAiConsent(false);
    await dbRecommendationsState.requestExternalAiRecommendations();
  };

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

      <section className="card space-y-4">
        <div>
          <p className="kicker">재료별 메뉴 찾기</p>
          <h2 className="mt-1.5 text-xl font-semibold text-slate-900">자주 남는 재료부터 골라보세요</h2>
          <p className="mt-1.5 text-sm leading-6 muted">
            실제 공개 레시피의 이름과 재료 정보를 기준으로 관련 메뉴를 모았습니다.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ingredientHubs.map((hub) => (
            <Link
              key={hub.slug}
              to={hub.path}
              className="soft-panel block transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2"
            >
              <p className="font-semibold text-slate-900">{hub.name}</p>
              <p className="mt-1 text-sm leading-6 muted">관련 공개 레시피 {hub.recipes.length}개</p>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {guidePages.map((guide) => (
            <Link key={guide.slug} to={guide.path} className="btn-secondary">
              {guide.slug === 'fridge-cleanout' ? '냉장고 파먹기 가이드' : '임박 재료 활용 가이드'}
            </Link>
          ))}
        </div>
      </section>

      <section className="card space-y-4">
        <div>
          <p className="kicker">공개 레시피</p>
          <h2 className="mt-1.5 text-xl font-semibold text-slate-900">식약처 조리법부터 둘러보세요</h2>
          <p className="mt-1.5 text-sm leading-6 muted">
            식품의약품안전처 공개 데이터에서 재료, 만드는 법, 이미지와 영양 정보가 모두 확인된 레시피입니다.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {publicRecipeCatalog.slice(0, 12).map((recipe) => (
            <Link key={recipe.externalId} to={getPublicRecipePath(recipe)} className="soft-panel group block">
              <img
                src={recipe.imageSmallUrl || recipe.imageLargeUrl}
                alt=""
                className="aspect-[16/9] w-full rounded-md bg-slate-100 object-cover"
                loading="lazy"
                decoding="async"
              />
              <p className="mt-3 font-semibold text-slate-900 group-hover:text-brand-700">{recipe.name}</p>
              <p className="mt-1 text-xs leading-5 muted">
                {[recipe.dishType, recipe.cookingMethod, `${recipe.steps.length}단계`].filter(Boolean).join(' · ')}
              </p>
            </Link>
          ))}
        </div>
        <details className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700">
            전체 {publicRecipeCatalog.length}개 공개 레시피 목록
          </summary>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            {publicRecipeLinksByDishType.map(([dishType, recipes]) => (
              <section key={dishType} aria-labelledby={`recipe-group-${dishType}`}>
                <h3 id={`recipe-group-${dishType}`} className="text-sm font-semibold text-slate-900">
                  {dishType} {recipes.length}개
                </h3>
                <ul className="mt-2 space-y-1.5 text-sm leading-6">
                  {recipes.map((recipe) => (
                    <li key={recipe.id}>
                      <Link className="text-slate-600 underline-offset-2 hover:text-brand-700 hover:underline" to={recipe.path}>
                        {recipe.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </details>
      </section>

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

      <section className="card border-l-4 border-l-brand-500 bg-white">
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
              <p className="text-xs font-bold text-slate-700">{'\uD604\uC7AC \uB4F1\uB85D \uC7AC\uB8CC'}</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">{loading ? '...' : activeIngredientCount}</p>
              <p className="mt-1 text-xs muted">{'\uBCF4\uC720 \uC911\uC778 \uC7AC\uB8CC \uAE30\uC900'}</p>
            </div>
            <div className="soft-panel border-amber-100/70 bg-amber-50/70">
              <p className="text-xs font-bold text-amber-800">{'\uC720\uD1B5\uAE30\uD55C \uC784\uBC15'}</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">{loading ? '...' : summary.expiringSoon}</p>
              <p className="mt-1 text-xs muted">{'\uC6B0\uC120 \uC18C\uBE44\uD558\uBA74 \uC88B\uC740 \uC7AC\uB8CC'}</p>
            </div>
            <div className="soft-panel border-brand-100/70 bg-white/80">
              <p className="text-xs font-bold text-brand-700">{'\uCD94\uCC9C \uD3ED \uB113\uD788\uAE30'}</p>
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

      {isExternalAiUiEnabled() && !dbRecommendationsState.hidden && !dbRecommendationsState.needsLogin ? (
        <section className="rounded-lg border border-cyan-200 bg-cyan-50/70 p-4 sm:p-5" aria-labelledby="external-ai-title">
          <h2 id="external-ai-title" className="text-base font-semibold text-slate-900">
            외부 AI 유사도 검색은 선택 사항이에요
          </h2>
          <p id="external-ai-disclosure" className="mt-1.5 text-sm leading-6 text-slate-700">
            실행하면 현재 활성 재료명을 바탕으로 만든 짧은 검색 문자열을 OpenAI에 한 번 전송해 레시피
            유사도를 계산합니다. 수량, 정확한 유통기한, 메모, 이메일은 보내지 않습니다. 기본 추천은 이 기능을
            사용하지 않아도 계속 이용할 수 있습니다. 자세한 내용은{' '}
            <Link className="font-semibold text-brand-700 underline underline-offset-2" to="/privacy">
              개인정보 처리 안내
            </Link>
            에서 확인할 수 있습니다.
          </p>
          <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 rounded-md bg-white p-3 text-sm text-slate-800">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 rounded border-slate-300 text-brand-700 focus:ring-brand-600"
              checked={externalAiConsent}
              onChange={(event) => setExternalAiConsent(event.target.checked)}
            />
            <span>이번 요청에 한해 위 항목을 OpenAI로 전송하는 데 동의합니다.</span>
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-primary min-h-11"
              aria-describedby="external-ai-disclosure"
              disabled={!externalAiConsent || dbRecommendationsState.loading || activeIngredientCount === 0}
              onClick={handleExternalAiRequest}
            >
              {dbRecommendationsState.loading ? '추천을 찾는 중...' : 'OpenAI로 유사 레시피 찾기'}
            </button>
            {dbRecommendationsState.mode === 'semantic' ? (
              <p className="text-sm text-cyan-900" role="status">외부 AI 유사도를 반영한 결과예요.</p>
            ) : null}
            {dbRecommendationsState.mode === 'rule-fallback' ? (
              <p className="text-sm text-slate-700" role="status">외부 AI 결과를 사용할 수 없어 서버 기본 추천을 표시합니다.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      <RecommendationRow
        title={dbRecommendationsState.mode === 'semantic' ? '외부 AI 유사도 추천' : '서버 카탈로그 추천'}
        description={
          dbRecommendationsState.mode === 'semantic'
            ? '명시적으로 요청한 OpenAI 유사도와 서버의 재료 점수를 함께 반영했어요.'
            : '서버 레시피 카탈로그를 재료 점수로 정렬하며 외부 AI에는 전송하지 않아요.'
        }
        recipes={dbRecommendationsState.recommendations}
        loading={dbRecommendationsState.loading}
        error={dbRecommendationsState.error}
        hidden={dbRecommendationsState.hidden}
        needsLogin={dbRecommendationsState.needsLogin}
        observeRef={dbRecommendationsState.rowRef}
        source={dbRecommendationsState.mode === 'semantic' ? 'hybrid' : 'rule'}
        loginMessage={'로그인하면 서버 카탈로그 추천을 볼 수 있어요'}
        onRecipeSelect={handleRecommendationSelect('ai')}
        emptyTitle={'AI 추천 후보가 아직 없어요'}
        emptyDescription={'DB 레시피 카탈로그에 매칭되는 후보가 생기면 이 행에 표시됩니다.'}
        emptyActionLabel={'재료 등록하러 가기'}
        emptyActionTo="/ingredients/new"
      />
      <AdSenseSlot placement="recipes" />
    </div>
  );
}

export default RecipesPage;
