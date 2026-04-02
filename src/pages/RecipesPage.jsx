import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import PantryStaplesPanel from '../components/PantryStaplesPanel';
import RecommendationSection from '../components/RecommendationSection';
import StatCard from '../components/StatCard';
import { aiSuggestRecipes, RecipesApiError } from '../api/recipesApi';
import { PANTRY_STATUS } from '../data/pantryStaples';
import { usePantryStaples } from '../hooks/usePantryStaples';
import { useRecipeRecommendations } from '../hooks/useRecipeRecommendations';
import { isBackendEnabled } from '../utils/backendConfig';
import { getDashboardSummary } from '../utils/date';

const BASIC_INGREDIENTS = ['계란', '양파', '대파', '두부', '버섯'];

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

function getMissingBasicIngredients(ingredients) {
  const owned = new Set(ingredients.filter((ingredient) => !ingredient.consumed).map((ingredient) => normalizeName(ingredient.name)));
  return BASIC_INGREDIENTS.filter((ingredient) => !owned.has(normalizeName(ingredient)));
}

function getSectionHelperText(count, emptyText, lowText, positiveText) {
  if (!count) {
    return emptyText;
  }

  if (count <= 2) {
    return lowText;
  }

  return positiveText;
}

function RecipesPage() {
  const { pantryStaples, pantryOwnership, pantrySummary, cyclePantryStatus } = usePantryStaples();
  const { recommendations, loading, error, ingredients } = useRecipeRecommendations(pantryOwnership);
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const summary = useMemo(() => getDashboardSummary(ingredients), [ingredients]);
  const missingBasicIngredients = useMemo(() => getMissingBasicIngredients(ingredients).slice(0, 5), [ingredients]);
  const activeIngredientCount = useMemo(() => ingredients.filter((ingredient) => !ingredient.consumed).length, [ingredients]);
  const readyRecommendations = useMemo(() => recommendations.filter((recipe) => recipe.canMakeNow), [recommendations]);
  const buyOneRecommendations = useMemo(
    () => recommendations.filter((recipe) => !recipe.canMakeNow && recipe.missingCore.length === 1),
    [recommendations]
  );
  const otherRecommendations = useMemo(
    () => recommendations.filter((recipe) => !recipe.canMakeNow && recipe.missingCore.length !== 1 && recipe.score > 0),
    [recommendations]
  );
  const recommendationCoverage = useMemo(
    () => readyRecommendations.length + buyOneRecommendations.length,
    [buyOneRecommendations.length, readyRecommendations.length]
  );
  const ownedPantryCount = useMemo(
    () => pantryStaples.filter((staple) => pantryOwnership[staple.id] === PANTRY_STATUS.OWNED).length,
    [pantryOwnership, pantryStaples]
  );

  const fridgeInsight = useMemo(() => {
    if (activeIngredientCount < 4) {
      return '등록된 재료가 아직 적어서 추천 폭이 좁아요. 기본 재료 몇 가지만 채워도 결과가 훨씬 넓어져요.';
    }

    if (!recommendationCoverage) {
      return '조합은 아직 적지만, 핵심 재료와 자주 쓰는 기본 조미료를 함께 갖추면 바로 만들 수 있는 메뉴가 늘어날 가능성이 커요.';
    }

    if (summary.expiringSoon > 0) {
      return '유통기한이 가까운 재료가 있어서 소비 우선순위를 기준으로 추천을 조금 더 위에 올려두었어요.';
    }

    return '지금 있는 재료만으로도 몇 가지 후보를 바로 살펴볼 수 있어요.';
  }, [activeIngredientCount, recommendationCoverage, summary.expiringSoon]);

  const sectionStats = useMemo(
    () => ({
      ready: {
        value: loading ? '...' : readyRecommendations.length,
        helper: loading
          ? '추천을 정리 중이에요'
          : getSectionHelperText(
              readyRecommendations.length,
              '아직 없어요',
              '바로 해볼 수 있어요',
              '오늘 바로 고를 수 있어요'
            )
      },
      buyOne: {
        value: loading ? '...' : buyOneRecommendations.length,
        helper: loading
          ? '추천을 정리 중이에요'
          : getSectionHelperText(
              buyOneRecommendations.length,
              '재료가 조금 더 필요해요',
              '한 두 개만 채우면 돼요',
              '장보기 효율이 좋아요'
            )
      },
      other: {
        value: loading ? '...' : otherRecommendations.length,
        helper: loading
          ? '추천을 정리 중이에요'
          : getSectionHelperText(
              otherRecommendations.length,
              '아직 후보가 적어요',
              '먼저 처리할 재료가 보여요',
              '소비 순서를 잡기 좋아요'
            )
      }
    }),
    [buyOneRecommendations.length, loading, otherRecommendations.length, readyRecommendations.length]
  );

  useEffect(() => {
    const activeIngredients = ingredients.filter((ingredient) => !ingredient.consumed);

    if (!isBackendEnabled()) {
      setAiRecommendations([]);
      setAiError('');
      setAiLoading(false);
      return;
    }

    if (!activeIngredients.length) {
      setAiRecommendations([]);
      setAiError('');
      setAiLoading(false);
      return;
    }

    let isMounted = true;

    const loadAiSuggestions = async () => {
      setAiLoading(true);
      setAiError('');

      try {
        const suggestions = await aiSuggestRecipes(activeIngredients);

        if (!isMounted) {
          return;
        }

        setAiRecommendations(Array.isArray(suggestions) ? suggestions : []);
      } catch (nextError) {
        if (!isMounted) {
          return;
        }

        if (nextError instanceof RecipesApiError) {
          setAiError(nextError.message || 'AI 추천을 불러오지 못했어요.');
        } else {
          setAiError('AI 추천을 불러오지 못했어요.');
        }
        setAiRecommendations([]);
      } finally {
        if (isMounted) {
          setAiLoading(false);
        }
      }
    };

    loadAiSuggestions();

    return () => {
      isMounted = false;
    };
  }, [ingredients]);

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
        <StatCard
          label={'\uC9C0\uAE08 \uB9CC\uB4E4 \uC218 \uC788\uC5B4\uC694'}
          value={sectionStats.ready.value}
          helper={sectionStats.ready.helper}
        />
        <StatCard
          label={'\uD558\uB098\uB9CC \uB354 \uC0AC\uBA74 \uB3FC\uC694'}
          value={sectionStats.buyOne.value}
          tone="warning"
          helper={sectionStats.buyOne.helper}
        />
        <StatCard
          label={'\uBE68\uB9AC \uC368\uC57C \uD560 \uC7AC\uB8CC \uC911\uC2EC'}
          value={sectionStats.other.value}
          tone="danger"
          helper={sectionStats.other.helper}
        />
      </section>

      <section className="card bg-gradient-to-br from-brand-50/80 via-white/50 to-amber-50/70">
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            <div>
              <p className="kicker">{'\uCD94\uCC9C \uAE30\uC900 \u0026 \uD604\uC7AC \uC0C1\uD0DC'}</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">{'\uB0C9\uC7A5\uACE0 \uD604\uD669\uC744 \uBCF4\uACE0 \uC9C0\uAE08 \uD574\uBCFC \uC218 \uC788\uB294 \uAC83\uBD80\uD130 \uACE8\uB790\uC5B4\uC694'}</h3>
            </div>
            <p className="text-sm leading-6 muted">
              {'\uD575\uC2EC \uC7AC\uB8CC \uC77C\uCE58 \uBE44\uC728\uC744 \uAC00\uC7A5 \uD06C\uAC8C \uBCF4\uACE0, \uC120\uD0DD \uC7AC\uB8CC\uB294 \uBCF4\uC870 \uAC00\uC0B0\uC810, \uD32C\uD2B8\uB9AC \uC7AC\uB8CC\uB294 \uC57D\uD55C \uBCF4\uC815\uC73C\uB85C\uB9CC \uBC18\uC601\uD574\uC11C \uCD94\uCC9C\uC774 \uACFC\uD558\uAC8C \uB9C9\uD788\uC9C0 \uC54A\uAC8C \uD588\uC5B4\uC694.'}
            </p>
            <p className="text-sm leading-6 text-slate-700">{fridgeInsight}</p>
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
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="soft-panel">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{'\uD604\uC7AC \uB4F1\uB85D \uC7AC\uB8CC'}</p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">{loading ? '...' : activeIngredientCount}</p>
              <p className="mt-1 text-xs muted">{'\uC18C\uBE44 \uC911\uC778 \uC7AC\uB8CC \uAE30\uC900'}</p>
            </div>
            <div className="soft-panel border-amber-100/70 bg-amber-50/70">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">{'\uC720\uD1B5\uAE30\uD55C \uC784\uBC15'}</p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">{loading ? '...' : summary.expiringSoon}</p>
              <p className="mt-1 text-xs muted">{'\uC6B0\uC120 \uC18C\uBE44\uD558\uBA74 \uC88B\uC740 \uC7AC\uB8CC'}</p>
            </div>
            <div className="soft-panel border-brand-100/70 bg-white/80">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">{'\uCD94\uCC9C \uD3ED \uB113\uD788\uAE30'}</p>
              <p className="mt-3 text-sm font-medium leading-6 text-slate-900">
                {missingBasicIngredients.length
                  ? `${missingBasicIngredients.slice(0, 3).join(', ')}\uC744 \uCC44\uC6B0\uBA74 \uCD94\uCC9C\uC774 \uB354 \uB2E4\uC591\uD574\uC838\uC694.`
                  : '\uAE30\uBCF8 \uC7AC\uB8CC\uB294 \uC5B4\uB290 \uC815\uB3C4 \uAC16\uCDB0\uC838 \uC788\uC5B4\uC694.'}
              </p>
              <p className="mt-2 text-xs muted">{`팬트리 보유 설정 ${ownedPantryCount}개`}</p>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <PantryStaplesPanel
            items={pantryStaples}
            pantryOwnership={pantryOwnership}
            pantrySummary={pantrySummary}
            onCycle={cyclePantryStatus}
          />
        </div>
      </section>

      {error ? <div className="card border border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</div> : null}

      <RecommendationSection
        title={'\uC9C0\uAE08 \uB9CC\uB4E4 \uC218 \uC788\uC5B4\uC694'}
        description={'\uD544\uC218 \uC7AC\uB8CC\uAC00 \uBAA8\uB450 \uB9DE\uB294 \uB808\uC2DC\uD53C\uC608\uC694. \uC624\uB298 \uBC14\uB85C \uD574\uBA39\uAE30 \uC88B\uC544\uC694.'}
        recipes={readyRecommendations}
        emptyTitle={'\uC544\uC9C1 \uBC14\uB85C \uB9CC\uB4E4 \uC218 \uC788\uB294 \uB808\uC2DC\uD53C\uAC00 \uC5C6\uC5B4\uC694'}
        emptyDescription={'\uACC4\uB780, \uC591\uD30C, \uB300\uD30C \uAC19\uC740 \uAE30\uBCF8 \uC7AC\uB8CC 2~3\uAC1C\uB9CC \uB354 \uCC44\uC6B0\uBA74 \uBC14\uB85C \uD574\uBCFC \uC218 \uC788\uB294 \uBA54\uB274\uAC00 \uB298\uC5B4\uB0A0 \uAC00\uB2A5\uC131\uC774 \uCEE4\uC694.'}
        emptyActionLabel={'\uC7AC\uB8CC \uCD94\uAC00\uD558\uAE30'}
        emptyActionTo={'/ingredients/new'}
        secondaryActionLabel={'OCR\uB85C \uBD88\uB7EC\uC624\uAE30'}
        secondaryActionTo={'/import'}
        suggestedIngredients={missingBasicIngredients}
      />

      <RecommendationSection
        title={'\uD558\uB098\uB9CC \uB354 \uC0AC\uBA74 \uB3FC\uC694'}
        description={'\uD544\uC218 \uC7AC\uB8CC\uAC00 \uB531 1\uAC1C\uB9CC \uBD80\uC871\uD55C \uAC70\uC758 \uC644\uC131 \uC0C1\uD0DC\uC758 \uB808\uC2DC\uD53C\uB4E4\uC785\uB2C8\uB2E4.'}
        recipes={buyOneRecommendations}
        emptyTitle={'\uC9C0\uAE08\uC740 \uD55C \uAC1C \uBD80\uC871\uD55C \uB808\uC2DC\uD53C\uAC00 \uC5C6\uC5B4\uC694'}
        emptyDescription={'\uC7A5\uBCF4\uAE30 \uB54C \uD544\uC694\uD55C \uAE30\uBCF8 \uC7AC\uB8CC\uB97C \uC870\uAE08\uC529 \uCC44\uC6B0\uBA74 \u2018\uD558\uB098\uB9CC \uB354 \uC0AC\uBA74 \uB3FC\uC694\u2019 \uC139\uC158\uC774 \uAC00\uC7A5 \uBE68\uB9AC \uB290\uB294 \uD3B8\uC774\uC5D0\uC694.'}
        emptyActionLabel={'\uC7AC\uB8CC \uBAA9\uB85D \uBCF4\uAE30'}
        emptyActionTo={'/ingredients'}
        secondaryActionLabel={'\uC7AC\uB8CC \uCD94\uAC00\uD558\uAE30'}
        secondaryActionTo={'/ingredients/new'}
        suggestedIngredients={missingBasicIngredients}
      />

      <RecommendationSection
        title={'\uBE68\uB9AC \uC368\uC57C \uD560 \uC7AC\uB8CC\uB85C \uB9CC\uB4E4 \uC218 \uC788\uC5B4\uC694'}
        description={'\uC77C\uBD80 \uC7AC\uB8CC\uAC00 \uB9DE\uB294 \uBA54\uB274 \uC911\uC5D0\uC11C\uB3C4 \uC18C\uBE44 \uC6B0\uC120\uC21C\uC704\uAC00 \uC788\uB294 \uD6C4\uBCF4\uB97C \uBA3C\uC800 \uBCF4\uC5EC\uC918\uC694.'}
        recipes={otherRecommendations}
        emptyTitle={'\uC9C0\uAE08 \uCC98\uB9AC\uD558\uBA74 \uC88B\uC740 \uC7AC\uB8CC \uC911\uC2EC \uCD94\uCC9C\uC740 \uC544\uC9C1 \uC801\uC5B4\uC694'}
        emptyDescription={'\uC720\uD1B5\uAE30\uD55C\uC774 \uAC00\uAE4C\uC6B4 \uC7AC\uB8CC\uAC00 \uC0DD\uAE30\uAC70\uB098 \uAE30\uBCF8 \uC7AC\uB8CC\uAC00 \uC870\uAE08 \uB354 \uC313\uC774\uBA74 \uC18C\uBE44 \uC6B0\uC120 \uCD94\uCC9C\uC774 \uB354 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uB298\uC5B4\uB0A9\uB2C8\uB2E4.'}
        emptyActionLabel={'OCR\uB85C \uC7AC\uB8CC \uBD88\uB7EC\uC624\uAE30'}
        emptyActionTo={'/import'}
        secondaryActionLabel={'\uC7AC\uB8CC \uCD94\uAC00\uD558\uAE30'}
        secondaryActionTo={'/ingredients/new'}
        suggestedIngredients={missingBasicIngredients}
      />

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-2xl font-semibold text-slate-900">{'AI 추천 레시피'}</h3>
            <p className="mt-1 text-sm leading-6 muted">
              {'Claude가 유통기한이 가까운 재료를 우선 소진하는 방향으로 새로운 조합을 제안해줘요.'}
            </p>
          </div>
          {aiRecommendations.length ? <span className="badge bg-white text-slate-500">{`레시피 ${aiRecommendations.length}개`}</span> : null}
        </div>

        {aiLoading ? <div className="card text-sm muted">{'AI 추천을 생성하는 중이에요...'}</div> : null}
        {aiError ? <div className="card border border-rose-200 bg-rose-50 text-sm text-rose-700">{aiError}</div> : null}

        {!aiLoading && !aiRecommendations.length ? (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/70 p-5">
            <p className="text-base font-semibold text-slate-900">{'AI 추천을 아직 만들지 못했어요'}</p>
            <p className="mt-2 text-sm leading-6 muted">
              {'보유 재료가 있어야 추천할 수 있고, Claude 호출이 실패하면 규칙 기반 결과로 대체돼요.'}
            </p>
          </div>
        ) : null}

        {aiRecommendations.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {aiRecommendations.map((recipe, index) => (
              <article key={`${recipe.title}-${index}`} className="card overflow-hidden">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="kicker">{'AI 제안'}</p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-900">{recipe.title}</h3>
                      <p className="mt-2 text-sm leading-6 muted">{recipe.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recipe.cookingTime ? <span className="badge bg-white text-slate-600">{recipe.cookingTime}</span> : null}
                      {recipe.difficulty ? <span className="badge bg-white text-slate-600">{recipe.difficulty}</span> : null}
                    </div>
                  </div>

                  <div className="soft-panel">
                    <p className="text-sm font-semibold text-slate-900">{'사용 재료'}</p>
                    <p className="mt-2 text-sm leading-6 muted">{(recipe.ingredients || []).join(', ') || '정보 없음'}</p>
                  </div>

                  {(recipe.tags || []).length ? (
                    <div className="flex flex-wrap gap-2">
                      {recipe.tags.map((tag) => (
                        <span key={tag} className="badge bg-brand-50 text-brand-700">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default RecipesPage;
