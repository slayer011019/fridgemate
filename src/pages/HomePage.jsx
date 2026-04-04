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
    <div className="space-y-5">
      <PageHeader
        eyebrow="대시보드"
        title="오늘의 냉장고를 산뜻하게 정리해볼까요?"
        description="냉장고 속 재료 현황과 유통기한 위험, 그리고 지금 만들 수 있는 레시피까지 하나의 흐름으로 보여줍니다."
        action={
          <>
            {ocrEnabled ? (
              <Link to="/import" className="btn-secondary">
                스크린샷 불러오기
              </Link>
            ) : null}
            <Link to="/ingredients/new" className="btn-primary">
              재료 추가
            </Link>
          </>
        }
      />

      <section className="grid gap-3 md:grid-cols-3">
        <StatCard label="전체 재료" value={loading ? '...' : summary.total} />
        <StatCard label="곧 만료" value={loading ? '...' : summary.expiringSoon} tone="warning" />
        <StatCard label="이미 지남" value={loading ? '...' : summary.expired} tone="danger" />
      </section>

      <section className="card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="kicker">먼저 써야 할 재료</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">유통기한 임박 리스트</h3>
            <p className="mt-2 text-sm leading-6 muted">
              당장 소비하면 좋은 재료를 먼저 보여줘 장보기와 요리 순서를 정리합니다.
            </p>
          </div>
          <Link to="/ingredients" className="btn-secondary">
            전체 재료 보기
          </Link>
        </div>

        <div className="mt-4 grid gap-2.5 lg:grid-cols-2">
          {!loading && !upcomingItems.length ? (
            <EmptyState
              title="아직 저장된 재료가 없어요"
              description="첫 재료를 추가하면 유통기한 관리와 음식물 낭비 줄이기를 바로 시작할 수 있어요."
            />
          ) : null}

          {upcomingItems.map((ingredient) => (
            <div key={ingredient.id} className="soft-panel flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-900">{ingredient.name}</p>
                <p className="mt-1 text-sm muted">
                  {`${getCategoryLabel(ingredient.category)} / ${getStorageLabel(ingredient.storageType)} / 유통기한 ${ingredient.expiryDate || '-'}`}
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
            <p className="kicker">오늘의 요리 힌트</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">추천 레시피 미리보기</h3>
            <p className="mt-2 text-sm leading-6 muted">
              재료 목록이 바뀌면 추천 결과도 자동으로 함께 업데이트됩니다.
            </p>
          </div>
          <Link to="/recipes" className="btn-secondary">
            레시피 추천 보기
          </Link>
        </div>

        <div className="mt-4">
          {!loading && !topRecommendations.length ? (
            <EmptyState
              title="아직 추천 가능한 레시피가 없어요"
              description="보유 중인 재료를 추가하면 여기에 잘 맞는 레시피가 나타납니다."
            />
          ) : null}

          <div className="grid gap-3 xl:grid-cols-3">
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
