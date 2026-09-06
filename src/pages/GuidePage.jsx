import { Link, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { getGuideBySlug, ingredientHubs } from '../features/recipes/recipeContentHubs';
import { editorialReviewNote } from '../features/recipes/recipeEditorialContent';
import NotFoundPage from './NotFoundPage';

function GuidePage() {
  const { guideSlug } = useParams();
  const guide = getGuideBySlug(guideSlug);

  if (!guide) return <NotFoundPage />;

  const relatedHubs = guide.relatedHubSlugs
    .map((slug) => ingredientHubs.find((hub) => hub.slug === slug))
    .filter(Boolean);

  return (
    <article className="section-shell mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-10">
      <nav aria-label="현재 위치" className="px-1 text-xs text-slate-500">
        <Link className="font-medium hover:text-brand-700" to="/">
          홈
        </Link>{' '}
        <span aria-hidden="true">/</span> <span>활용 가이드</span>
      </nav>

      <PageHeader
        eyebrow="냉장고 활용 가이드"
        title={guide.heading}
        description={guide.description}
        action={
          <Link to="/ingredients/new" className="btn-primary">
            원하면 내 재료 등록
          </Link>
        }
      />

      <section className="card space-y-5 text-sm leading-7 text-slate-700">
        <p>{guide.intro}</p>
      </section>

      <section className="card space-y-5" aria-labelledby="example-heading">
        <div>
          <p className="kicker">저장하지 않고 살펴보는 예시</p>
          <h2 id="example-heading" className="mt-1.5 text-xl font-semibold text-slate-900">{guide.example.title}</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700">{guide.example.summary}</p>
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">예시 냉장고와 양념</h3>
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {guide.example.inventory.map((item) => (
              <li key={item.name} className="soft-panel"><span className="font-semibold">{item.name}</span> · {item.amount}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs leading-6 muted">아래 링크는 이 예시의 재료 종류만 상세 화면에 전달합니다. 보유량을 자동 판정하거나 내 냉장고에 저장하지 않습니다.</p>
        </div>
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-900">후보별로 무엇이 더 필요한가요?</h3>
          {guide.example.candidates.map((candidate) => (
            <article key={candidate.recipeId} className="soft-panel space-y-2 text-sm leading-7">
              <h4 className="text-base font-semibold text-slate-900">
                {candidate.recipeId === guide.example.selectedRecipeId ? <span className="mr-2 text-green-800">선택</span> : null}
                <Link className="underline underline-offset-4 hover:text-brand-700" to={candidate.examplePath}>{candidate.recipe.name}</Link>
              </h4>
              <p>{candidate.selectionReason}</p>
              <p><span className="font-semibold">예시에 없는 재료:</span> {candidate.missingIngredients.map((item) => `${item.name} ${item.amount}`).join(', ') || '없음'}</p>
              <p><span className="font-semibold">준비 도구:</span> {candidate.equipment.join(' · ')}</p>
            </article>
          ))}
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm leading-7 text-slate-800">
          <h3 className="font-semibold text-slate-900">선택한 메뉴의 추가 준비 목록</h3>
          <ul className="mt-2 list-disc pl-5">
            {guide.example.selectedRecipe.missingIngredients.map((item) => <li key={item.name}>{item.name} {item.amount}</li>)}
          </ul>
          <p className="mt-3">{guide.example.conclusion}</p>
          <Link className="btn-primary mt-4" to={guide.example.selectedRecipe.examplePath}>예시 재료로 선택한 조리법 보기</Link>
        </div>
      </section>

      <section className="card space-y-5 text-sm leading-7 text-slate-700">
        <h2 className="text-xl font-semibold text-slate-900">내 냉장고에 적용하는 순서</h2>
        <ol className="space-y-4">
          {guide.steps.map((step, index) => (
            <li key={step.title} className="soft-panel grid gap-3 sm:grid-cols-[2.5rem_1fr]">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-green-700 text-sm font-bold text-white"
              >
                {index + 1}
              </span>
              <div>
                <h3 className="text-base font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-1">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          제품의 소비기한과 표시된 보관방법을 지켜주세요. 겉모습이나 냄새가 정상이어도 안전하다고 단정할 수 없습니다.{' '}
          <a className="underline underline-offset-2" href="https://www.youtube.com/watch?v=dusgGQikgGc" target="_blank" rel="noreferrer">식약처 소비기한·보관방법 안내</a>{' · '}
          <a className="underline underline-offset-2" href="https://www.fda.gov/consumers/consumer-updates/are-you-storing-food-safely" target="_blank" rel="noreferrer">FDA 식품 보관 안내</a>
        </p>
        <p className="text-xs leading-6 muted">{editorialReviewNote} 원문 및 보관 안내 대조: {guide.reviewedAt}. 예시의 선택 이유와 남는 양은 표시된 재료 목록을 바탕으로 작성했습니다.</p>
      </section>

      <section className="card space-y-4">
        <div>
          <p className="kicker">다음 메뉴 찾기</p>
          <h2 className="mt-1.5 text-xl font-semibold text-slate-900">자주 남는 재료부터 살펴보세요</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {relatedHubs.map((hub) => (
            <Link
              key={hub.slug}
              to={hub.path}
              className="soft-panel block transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2"
            >
              <p className="font-semibold text-slate-900">{hub.name} 레시피 {hub.recipes.length}개</p>
              <p className="mt-1 text-sm leading-6 muted">{hub.description}</p>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/recipes" className="btn-primary">
            메뉴 추천 보기
          </Link>
          <Link to="/ingredients" className="btn-secondary">
            냉장고 재료 확인
          </Link>
        </div>
      </section>
    </article>
  );
}

export default GuidePage;
