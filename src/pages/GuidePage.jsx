import { Link, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { getGuideBySlug, ingredientHubs } from '../features/recipes/recipeContentHubs';
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
            재료 등록 시작
          </Link>
        }
      />

      <section className="card space-y-5 text-sm leading-7 text-slate-700">
        <p>{guide.intro}</p>
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
                <h2 className="text-base font-semibold text-slate-900">{step.title}</h2>
                <p className="mt-1">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          날짜 표시만으로 식품의 안전을 판단할 수 없습니다. 보관 방법과 실제 상태를 함께 확인하고, 섭취가 의심스러우면 사용하지 마세요.
        </p>
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
