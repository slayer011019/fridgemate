import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { publicRecipeCatalog } from '../features/recipes/publicRecipeCatalog';
import { ingredientHubs, guidePages } from '../features/recipes/recipeContentHubs';
import { getRecipeEditorial } from '../features/recipes/recipeEditorialContent';
import { getPlanningRecipePath, parsePlanningIngredients } from '../features/recipes/publicRecipePlanning';

function normalize(value) {
  return String(value || '').normalize('NFKC').replace(/\s/g, '').toLowerCase();
}

function RecipeResults({ candidates, selected, compact }) {
  const [limit, setLimit] = useState(12);
  const visibleCount = Math.min(compact ? 6 : limit, candidates.length);
  const nextCount = Math.min(12, candidates.length - visibleCount);

  return <>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {candidates.slice(0, visibleCount).map(({ recipe, matches, editorial }) => (
        <Link key={recipe.externalId} to={getPlanningRecipePath(recipe, selected)} className="soft-panel group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700">
          <img src={recipe.imageSmallUrl || recipe.imageLargeUrl} alt="" loading="lazy" decoding="async" className="aspect-[16/9] w-full rounded-md bg-slate-100 object-cover" />
          <h3 className="mt-3 font-semibold text-slate-950 group-hover:text-brand-700">{recipe.name}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">{recipe.cookingMethod} · 조리 {recipe.steps.length}단계</p>
          {matches.length ? <p className="mt-2 text-xs font-semibold text-brand-700">관련 재료: {matches.join(', ')}</p> : null}
          <p className="mt-2 text-sm leading-6 text-slate-600">{editorial?.selectionReason || '원문의 재료 분량과 만드는 순서를 확인하고 준비할 것을 골라보세요.'}</p>
          <span className="mt-3 block text-sm font-semibold text-brand-700">재료와 조리법 보기 →</span>
        </Link>
      ))}
    </div>
    {!compact && candidates.length > 0 ? <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-slate-600" aria-live="polite">{candidates.length}개 중 {visibleCount}개 표시</p>
      {nextCount > 0 ? <button type="button" className="btn-secondary" onClick={() => setLimit((current) => current + 12)}>
        메뉴 {nextCount}개 더 보기
      </button> : null}
    </div> : null}
  </>;
}

export default function PublicRecipeExplorer({ compact = false }) {
  const [params, setParams] = useSearchParams();
  const selected = parsePlanningIngredients(params.get('have'));
  const [draft, setDraft] = useState('');
  const selectionKey = selected.join(',');
  const candidates = publicRecipeCatalog.map((recipe) => {
      const text = normalize(recipe.ingredientsText);
      const matches = selected.filter((name) => {
        const hub = ingredientHubs.find((item) => item.keywords.some((keyword) => normalize(keyword) === normalize(name)));
        return hub ? hub.recipes.some((item) => item.externalId === recipe.externalId) : text.includes(normalize(name));
      });
      return { recipe, matches, editorial: getRecipeEditorial(recipe) };
    }).filter(({ matches }) => !selected.length || matches.length)
      .sort((a, b) => b.matches.length - a.matches.length || Number(Boolean(b.editorial)) - Number(Boolean(a.editorial)));

  const updateSelection = (names) => {
    const next = new URLSearchParams(params);
    if (names.length) next.set('have', names.join(','));
    else next.delete('have');
    setParams(next, { replace: true, preventScrollReset: true });
  };

  return (
    <section className="card space-y-5" aria-labelledby="public-explorer-title">
      <div>
        <p className="kicker">가입 없이 메뉴 둘러보기</p>
        <h2 id="public-explorer-title" className="mt-2 text-xl font-semibold text-slate-950 sm:text-2xl">남은 재료로 무엇을 만들까요?</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">재료를 고르면 관련 메뉴부터 보여드려요. 조리법에서 정확한 재료 종류와 분량을 확인하세요.</p>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="자주 남는 재료">
        {ingredientHubs.map((hub) => {
          const name = hub.keywords[0];
          const active = selected.includes(name);
          return <button key={hub.slug} type="button" aria-pressed={active}
            className={active ? 'btn-primary' : 'btn-secondary'}
            onClick={() => updateSelection(active ? selected.filter((item) => item !== name) : [...selected, name])}>{hub.name}</button>;
        })}
      </div>
      <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={(event) => {
        event.preventDefault();
        updateSelection(parsePlanningIngredients([...selected, draft].join(',')));
        setDraft('');
      }}>
        <label className="flex-1 text-sm font-medium text-slate-700">
          다른 재료도 찾아보기
          <input className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2" value={draft}
            maxLength={360} onChange={(event) => setDraft(event.target.value)} placeholder="예: 오이, 사과" />
        </label>
        <button className="btn-secondary" type="submit" disabled={!draft.trim()}>재료로 찾기</button>
      </form>
      {selected.length ? <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-slate-700">이번 탐색: {selected.join(', ')}</p>
        <button className="text-sm font-semibold text-brand-700 underline underline-offset-2" type="button" onClick={() => updateSelection([])}>선택 지우기</button>
      </div> : null}
      <p className="text-xs leading-5 text-slate-500">이 선택은 냉장고에 저장되지 않아요. 두부·버섯 등은 비슷한 종류를 함께 찾으며, 실제 보유 여부는 조리법에서 따로 확인합니다.</p>
      <p className="text-sm font-semibold text-slate-800" role="status">{selected.length ? `선택한 재료와 관련된 메뉴 ${candidates.length}개` : '조리법과 활용 설명을 함께 살펴보세요'}</p>
      {!candidates.length ? <div className="rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">
        일치하는 메뉴가 아직 없어요. 재료 이름을 짧게 적거나 위의 재료 버튼으로 다시 찾아보세요.
      </div> : null}
      {/* A new filter starts from the first page, including browser history changes. */}
      <RecipeResults key={selectionKey} candidates={candidates} selected={selected} compact={compact} />
      {compact ? <Link to={`/recipes${selectionKey ? `?have=${encodeURIComponent(selectionKey)}` : ''}`} className="btn-secondary">전체 메뉴 살펴보기</Link> : null}
      <div className="border-t border-slate-200 pt-4">
        <h3 className="text-sm font-semibold text-slate-900">재료를 고르는 과정이 궁금하다면</h3>
        <div className="mt-3 flex flex-wrap gap-2">{guidePages.map((guide) => <Link key={guide.slug} to={guide.path} className="btn-secondary">{guide.slug === 'fridge-cleanout' ? '예시 냉장고로 메뉴 고르기' : '먼저 쓸 재료로 메뉴 고르기'}</Link>)}</div>
      </div>
    </section>
  );
}
