import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import PantryStaplesPanel from '../components/PantryStaplesPanel';
import RecommendationSection from '../components/RecommendationSection';
import StatCard from '../components/StatCard';
import { aiSuggestRecipes, RecipesApiError } from '../api/recipesApi';
import { PANTRY_STATUS } from '../data/pantryStaples';
import {
  getMissingBasicIngredients,
  getSectionHelperText,
  splitRecommendationsByReadiness
} from '../features/recipes/recommendationSections';
import { useAuth } from '../hooks/useAuth';
import { usePantryStaples } from '../hooks/usePantryStaples';
import { useRecipeRecommendations } from '../hooks/useRecipeRecommendations';
import { isBackendEnabled, isOcrEnabled } from '../utils/backendConfig';
import { getDashboardSummary } from '../utils/date';

function RecipesPage() {
  const { isAuthenticated } = useAuth();
  const { pantryStaples, pantryOwnership, pantrySummary, cyclePantryStatus } = usePantryStaples();
  const ocrEnabled = isOcrEnabled();
  const ownedPantryItems = useMemo(
    () =>
      pantryStaples
        .filter((staple) => pantryOwnership[staple.id] === PANTRY_STATUS.OWNED)
        .map((staple) => staple.name),
    [pantryOwnership, pantryStaples]
  );
  const { recommendations, loading, error, ingredients } = useRecipeRecommendations(ownedPantryItems);
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const summary = useMemo(() => getDashboardSummary(ingredients), [ingredients]);
  const missingBasicIngredients = useMemo(() => getMissingBasicIngredients(ingredients), [ingredients]);
  const activeIngredientCount = useMemo(() => ingredients.filter((ingredient) => !ingredient.consumed).length, [ingredients]);
  const recommendationGroups = useMemo(() => splitRecommendationsByReadiness(recommendations), [recommendations]);
  const readyRecommendations = recommendationGroups.ready;
  const buyOneRecommendations = recommendationGroups.buyOneMore;
  const useSoonRecommendations = recommendationGroups.useSoon;
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
      return '등록된 재료가 아직 적어서 추천 폭이 넓지 않아요. 기본 재료 몇 가지만 더 채우면 결과가 훨씬 풍부해져요.';
    }

    if (!recommendationCoverage) {
      return '조합은 아직 제한적이지만 자주 쓰는 기본 재료를 조금만 보강하면 바로 만들 수 있는 메뉴가 훨씬 늘어날 수 있어요.';
    }

    if (summary.expiringSoon > 0) {
      return '유통기한이 가까운 재료가 있어서 소비 우선순위를 기준으로 추천을 조금 더 앞에 올려두었어요.';
    }

    return '지금 있는 재료만으로도 몇 가지 후보를 바로 검토해볼 수 있어요.';
  }, [activeIngredientCount, recommendationCoverage, summary.expiringSoon]);

  const sectionStats = useMemo(
    () => ({
      ready: {
        value: loading ? '...' : readyRecommendations.length,
        helper: loading
          ? '추천을 정리하는 중이에요'
          : getSectionHelperText(
              readyRecommendations.length,
              '아직 바로 가능한 메뉴는 적어요',
              '지금 바로 시작할 수 있는 메뉴가 보여요',
              '오늘 바로 해볼 선택지가 있어요'
            )
      },
      buyOne: {
        value: loading ? '...' : buyOneRecommendations.length,
        helper: loading
          ? '추천을 정리하는 중이에요'
          : getSectionHelperText(
              buyOneRecommendations.length,
              '조금만 더 채우면 좋아져요',
              '한 가지만 더 있으면 돼요',
              '장보기 효율이 좋아지고 있어요'
            )
      },
      useSoon: {
        value: loading ? '...' : useSoonRecommendations.length,
        helper: loading
          ? '추천을 정리하는 중이에요'
          : getSectionHelperText(
              useSoonRecommendations.length,
              '우선 처리할 재료는 아직 적어요',
              '먼저 꺼내야 할 재료가 보여요',
              '소비 우선순위를 잡기 좋아요'
            )
      }
    }),
    [buyOneRecommendations.length, loading, readyRecommendations.length, useSoonRecommendations.length]
  );

  useEffect(() => {
    const activeIngredients = ingredients.filter((ingredient) => !ingredient.consumed);

    if (!isBackendEnabled() || !isAuthenticated) {
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
  }, [ingredients, isAuthenticated]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="레시피"
        title="지금 가진 재료로 만들 수 있는 한 끼를 찾아보세요"
        description="보유 재료 기반 일치율에 가산점을 더해 추천해서, 무엇을 지금 해먹으면 좋을지 바로 판단할 수 있게 구성했습니다."
      />

      <section className="grid gap-3 md:grid-cols-3">
        <StatCard label="지금 만들 수 있어요" value={sectionStats.ready.value} helper={sectionStats.ready.helper} />
        <StatCard
          label="하나만 더 사면 돼요"
          value={sectionStats.buyOne.value}
          tone="warning"
          helper={sectionStats.buyOne.helper}
        />
        <StatCard
          label="빨리 써야 할 재료 중심"
          value={sectionStats.useSoon.value}
          tone="danger"
          helper={sectionStats.useSoon.helper}
        />
      </section>

      <section className="card bg-gradient-to-br from-brand-50/80 via-white/50 to-amber-50/70">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            <div>
              <p className="kicker">추천 기준 & 현재 상태</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">
                냉장고 현황을 보고 지금 해볼 수 있는 것부터 골랐어요
              </h3>
            </div>
            <p className="text-sm leading-6 muted">
              핵심 재료 일치 비율을 가장 크게 보고, 선택 재료는 보조 가산점, 팬트리 재료는 약한 보정으로만 반영해서
              추천이 과하게 막히지 않게 했어요.
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

          <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-1">
            <div className="soft-panel">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">현재 등록 재료</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">{loading ? '...' : activeIngredientCount}</p>
              <p className="mt-1 text-xs muted">소비 중인 재료 기준</p>
            </div>
            <div className="soft-panel border-amber-100/70 bg-amber-50/70">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">유통기한 임박</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">{loading ? '...' : summary.expiringSoon}</p>
              <p className="mt-1 text-xs muted">우선 소비하면 좋은 재료</p>
            </div>
            <div className="soft-panel border-brand-100/70 bg-white/80">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">추천 폭 넓히기</p>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-900">
                {missingBasicIngredients.length
                  ? `${missingBasicIngredients.slice(0, 3).join(', ')}을 채우면 추천이 더 다양해져요.`
                  : '기본 재료는 어느 정도 갖춰져 있어요.'}
              </p>
              <p className="mt-2 text-xs muted">{`팬트리 보유 설정 ${ownedPantryCount}개`}</p>
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

      {error ? <div className="card border border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</div> : null}

      <RecommendationSection
        title="지금 만들 수 있어요"
        description="필수 재료가 모두 맞는 레시피예요. 오늘 바로 해먹기 좋아요."
        recipes={readyRecommendations}
        emptyTitle="아직 바로 만들 수 있는 레시피가 없어요"
        emptyDescription="계란, 양파, 대파 같은 기본 재료 2~3개만 더 채우면 바로 해볼 수 있는 메뉴가 늘어날 가능성이 커요."
        emptyActionLabel="재료 추가하기"
        emptyActionTo="/ingredients/new"
        secondaryActionLabel={ocrEnabled ? 'OCR로 불러오기' : undefined}
        secondaryActionTo={ocrEnabled ? '/import' : undefined}
        suggestedIngredients={missingBasicIngredients}
      />

      <RecommendationSection
        title="하나만 더 사면 돼요"
        description="필수 재료가 딱 1개만 부족한 거의 완성 상태의 레시피들입니다."
        recipes={buyOneRecommendations}
        emptyTitle="지금은 한 개 부족한 레시피가 없어요"
        emptyDescription="장보기 때 필요한 기본 재료를 조금씩 채우면 ‘하나만 더 사면 돼요’ 섹션이 가장 빨리 늘어나는 편이에요."
        emptyActionLabel="재료 목록 보기"
        emptyActionTo="/ingredients"
        secondaryActionLabel="재료 추가하기"
        secondaryActionTo="/ingredients/new"
        suggestedIngredients={missingBasicIngredients}
      />

      <RecommendationSection
        title="빨리 써야 할 재료로 만들 수 있어요"
        description="일부 재료가 맞는 메뉴 중에서도 소비 우선순위가 있는 후보를 먼저 보여줘요."
        recipes={useSoonRecommendations}
        emptyTitle="지금 처리하면 좋은 재료 중심 추천은 아직 적어요"
        emptyDescription="유통기한이 가까운 재료가 생기거나 기본 재료가 조금 더 쌓이면 소비 우선 추천이 더 자연스럽게 늘어납니다."
        emptyActionLabel={ocrEnabled ? 'OCR로 재료 불러오기' : undefined}
        emptyActionTo={ocrEnabled ? '/import' : undefined}
        secondaryActionLabel="재료 추가하기"
        secondaryActionTo="/ingredients/new"
        suggestedIngredients={missingBasicIngredients}
      />

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 sm:text-2xl">AI 추천 레시피</h3>
            <p className="mt-1 text-sm leading-6 muted">
              Claude가 유통기한이 가까운 재료를 우선 소진하는 방향으로 새로운 조합을 제안해줍니다.
            </p>
          </div>
          {aiRecommendations.length ? <span className="badge bg-white text-slate-500">{`레시피 ${aiRecommendations.length}개`}</span> : null}
        </div>

        {aiLoading ? <div className="card text-sm muted">AI 추천을 생성하는 중이에요...</div> : null}
        {aiError ? <div className="card border border-rose-200 bg-rose-50 text-sm text-rose-700">{aiError}</div> : null}

        {!aiLoading && !aiRecommendations.length ? (
          <div className="rounded-[20px] border border-dashed border-slate-200 bg-white/70 p-4">
            <p className="text-base font-semibold text-slate-900">AI 추천은 아직 만들지 못했어요</p>
            <p className="mt-2 text-sm leading-6 muted">
              보유 재료가 있어야 추천을 만들 수 있고, Claude 호출에 실패하면 규칙 기반 결과로 대체됩니다.
            </p>
          </div>
        ) : null}

        {aiRecommendations.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {aiRecommendations.map((recipe, index) => (
              <article key={`${recipe.title}-${index}`} className="card overflow-hidden">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="kicker">AI 제안</p>
                      <h3 className="mt-2 text-lg font-semibold text-slate-900">{recipe.title}</h3>
                      <p className="mt-1.5 text-sm leading-6 muted">{recipe.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {recipe.cookingTime ? <span className="badge bg-white text-slate-600">{recipe.cookingTime}</span> : null}
                      {recipe.difficulty ? <span className="badge bg-white text-slate-600">{recipe.difficulty}</span> : null}
                    </div>
                  </div>

                  <div className="soft-panel">
                    <p className="text-sm font-semibold text-slate-900">사용 재료</p>
                    <p className="mt-1.5 text-sm leading-6 muted">{(recipe.ingredients || []).join(', ') || '정보 없음'}</p>
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
