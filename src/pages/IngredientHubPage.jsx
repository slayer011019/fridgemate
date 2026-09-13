import { Link, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { getPublicRecipePath } from '../features/recipes/publicRecipeCatalog';
import { getIngredientHubBySlug } from '../features/recipes/recipeContentHubs';
import { editorialReviewNote } from '../features/recipes/recipeEditorialContent';
import NotFoundPage from './NotFoundPage';

function IngredientHubPage() {
  const { ingredientSlug } = useParams();
  const hub = getIngredientHubBySlug(ingredientSlug);

  if (!hub) return <NotFoundPage />;

  return (
    <div className="section-shell mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-10">
      <nav aria-label="현재 위치" className="px-1 text-xs text-slate-500">
        <Link className="font-medium hover:text-brand-700" to="/recipes">
          메뉴 추천
        </Link>{' '}
        <span aria-hidden="true">/</span> <span>{hub.name}</span>
      </nav>

      <PageHeader
        eyebrow="재료별 레시피"
        title={hub.heading}
        description={`${hub.description} 현재 ${hub.recipes.length}개의 공개 레시피가 연결되어 있습니다.`}
        action={
          <Link to="/ingredients/new" className="btn-primary">
            내 냉장고에 재료 등록
          </Link>
        }
      />

      {hub.comparison ? (
        <section className="card space-y-5" aria-labelledby="recipe-comparison-heading">
          <div>
            <p className="kicker">메뉴 선택 도움</p>
            <h2 id="recipe-comparison-heading" className="mt-1.5 text-xl font-semibold text-slate-900">같은 재료, 어떤 메뉴를 고를까요?</h2>
            <p className="mt-2 text-sm leading-7 text-slate-700">{hub.comparison.intro}</p>
          </div>
          <div className="grid gap-4">
            {hub.comparison.rows.map((row) => (
              <article key={row.recipeId} className="soft-panel space-y-3">
                <h3 className="text-lg font-semibold text-slate-900">
                  <Link className="underline decoration-green-700/40 underline-offset-4 hover:text-brand-700" to={row.editorial.path}>
                    {row.editorial.recipe.name}
                  </Link>
                </h3>
                <dl className="grid gap-3 text-sm leading-6 sm:grid-cols-2">
                  <div><dt className="font-semibold text-slate-900">원문 사용량</dt><dd>{row.usage}</dd></div>
                  <div><dt className="font-semibold text-slate-900">함께 준비할 재료</dt><dd>{row.additionalIngredients}</dd></div>
                  <div><dt className="font-semibold text-slate-900">조리 도구</dt><dd>{row.editorial.equipment.join(' · ')}</dd></div>
                  <div><dt className="font-semibold text-slate-900">이럴 때 선택</dt><dd>{row.decision}</dd></div>
                </dl>
                <Link className="btn-secondary" to={row.editorial.path}>전체 재료와 조리법 확인</Link>
              </article>
            ))}
          </div>
          <p className="text-sm leading-7 text-slate-700">{hub.comparison.takeaway}</p>
          <p className="text-xs leading-6 muted">{editorialReviewNote} 원문 대조: {hub.comparison.reviewedAt}. 분량과 출처는 각 상세에서 확인할 수 있습니다.</p>
        </section>
      ) : null}

      <section className="card space-y-4">
        <div>
          <p className="kicker">식약처 공개 데이터</p>
          <h2 className="mt-1.5 text-xl font-semibold text-slate-900">{hub.name} 관련 레시피</h2>
          <p className="mt-1.5 text-sm leading-6 muted">
            각 상세 페이지에서 실제 재료, 조리 단계, 이미지, 영양 정보와 원문 출처를 확인할 수 있습니다.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {hub.recipes.map((recipe) => (
            <Link
              key={recipe.externalId}
              to={getPublicRecipePath(recipe)}
              className="soft-panel group block transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2"
            >
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
      </section>

      <section className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">가지고 있는 재료로 바로 비교해보세요</h2>
          <p className="mt-1 text-sm leading-6 muted">재료를 등록하면 만들기 좋은 메뉴와 부족한 핵심 재료를 함께 확인할 수 있습니다.</p>
        </div>
        <Link to="/recipes" className="btn-secondary shrink-0">
          맞춤 메뉴 추천 보기
        </Link>
      </section>
    </div>
  );
}

export default IngredientHubPage;
