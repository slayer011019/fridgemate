import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useIngredients } from '../hooks/useIngredients';
import { usePantryStaples } from '../hooks/usePantryStaples';
import { PANTRY_STATUS } from '../data/pantryStaples';
import { getRecipePreparationItems, isPreparationItemOwned, parsePlanningIngredients } from '../features/recipes/publicRecipePlanning';

export default function RecipePreparationChecklist({ recipe }) {
  const [params] = useSearchParams();
  const [changes, setChanges] = useState({});
  const [includeFridge, setIncludeFridge] = useState(false);
  const { ingredients } = useIngredients();
  const { pantryStaples, pantryOwnership } = usePantryStaples();
  const selected = parsePlanningIngredients(params.get('have'));
  const savedNames = [
    ...ingredients.filter((item) => !item.consumed).map((item) => item.name),
    ...pantryStaples.filter((item) => pantryOwnership[item.id] === PANTRY_STATUS.OWNED).map((item) => item.name)
  ];
  const names = includeFridge ? [...selected, ...savedNames] : selected;
  const items = getRecipePreparationItems(recipe);
  const checked = (item) => changes[item.id] ?? isPreparationItemOwned(item, names);
  const remaining = items.filter((item) => !checked(item) && item.role !== 'water');
  const automatic = items.some((item) => item.automatic);

  return <section className="card space-y-4" aria-labelledby="preparation-title">
    <div>
      <p className="kicker">조리 전 준비</p>
      <h2 id="preparation-title" className="mt-2 text-xl font-semibold text-slate-950">있는 재료를 체크하고 준비할 것을 확인하세요</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">체크는 이 화면에서만 유지됩니다. 재료의 보유량과 상태는 원문 분량을 보며 직접 확인하세요.</p>
    </div>
    {selected.length ? <p className="text-sm text-brand-800">이번 탐색에서 고른 재료: {selected.join(', ')}. {automatic ? '같은 이름으로 확인된 재료만 미리 체크했어요.' : '원문에 여러 재료가 묶여 있어 직접 체크해주세요.'}</p> : null}
    {savedNames.length ? <label className="flex min-h-11 items-center gap-3 rounded-md bg-brand-50 p-3 text-sm text-brand-900">
      <input type="checkbox" checked={includeFridge} onChange={(event) => { setIncludeFridge(event.target.checked); setChanges({}); }} />
      내 냉장고와 보유 양념도 반영하기
    </label> : null}
    {!automatic ? <p className="text-sm leading-6 text-slate-600">아래는 원문 재료 묶음입니다. 한 줄에 여러 재료가 있으면 모두 갖고 있을 때 체크하세요.</p> : null}
    <ul className="grid gap-2 sm:grid-cols-2">{items.map((item) => <li key={item.id}>
      <label className="flex h-full cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 text-sm leading-6">
        <input className="mt-1 h-4 w-4 shrink-0" type="checkbox" checked={checked(item)} onChange={(event) => setChanges((current) => ({ ...current, [item.id]: event.target.checked }))} />
        <span><span className="font-medium text-slate-900">{item.name}</span>{item.amount ? ` ${item.amount}` : ''}{item.role === 'water' ? ' · 조리용 물' : item.role === 'garnish' ? ' · 원문 고명' : ''}</span>
      </label>
    </li>)}</ul>
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4" aria-live="polite">
      <h3 className="font-semibold text-amber-950">추가 확인·준비 목록 {remaining.length}개</h3>
      {remaining.length ? <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-950">{remaining.map((item) => <li key={item.id}>{item.name}{item.amount ? ` ${item.amount}` : ''}</li>)}</ul>
        : <p className="mt-2 text-sm text-amber-950">재료를 모두 확인했어요. 조리용 물과 각 재료의 필요한 분량도 확인하고 아래 순서대로 준비하세요.</p>}
      <p className="mt-2 text-xs leading-5 text-amber-800">체크하지 않은 항목을 모았어요. 집에 없는지 확인한 뒤 필요한 것만 구매하세요.</p>
    </div>
    <Link to="/ingredients/new" className="btn-secondary">내 냉장고에 재료 기록하기</Link>
  </section>;
}
