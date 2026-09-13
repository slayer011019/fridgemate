import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useIngredients } from '../hooks/useIngredients';
import { useMealPlan } from '../hooks/useMealPlan';
import { usePantryStaples } from '../hooks/usePantryStaples';
import { PANTRY_STATUS } from '../data/pantryStaples';
import {
  addCalendarDays,
  generateMealPlan,
  getSlotSummary,
  getWeekStart,
  replaceMealPlanSlot,
  setMealPlanSlotSkipped,
  toggleMealPlanSlotLock
} from '../features/mealPlans/mealPlanDomain';

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const DEFAULT_PREFERENCES = { servings: 1, excludedIngredients: [], dinnerDays: [0, 1, 2, 3, 4, 5, 6] };

function shortDate(value) {
  return `${Number(value.slice(5, 7))}.${Number(value.slice(8, 10))}`;
}

function parseExcludedIngredients(value) {
  return [...new Set(value.split(/[,，\n]/).map((name) => name.trim()).filter(Boolean))];
}

function MealSlot({ slot, dayIndex, ingredients, pantryItems, disabled, onReplace, onLock, onSkip }) {
  const summary = getSlotSummary(slot, ingredients, pantryItems);
  const planned = slot.status === 'planned';

  return (
    <article className={`meal-plan-day ${planned ? '' : 'meal-plan-day-muted'}`} aria-label={`${slot.date} 저녁 식단`}>
      <div className="meal-plan-date">
        <span className="text-sm font-semibold">{DAYS[dayIndex]}요일</span>
        <time dateTime={slot.date} className="text-2xl font-semibold tabular-nums tracking-tight">{shortDate(slot.date)}</time>
        <span className="text-xs muted">저녁 · {slot.servings}인</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-lg font-semibold leading-7 text-slate-900">
            {planned ? slot.title : slot.status === 'skipped' ? '외식하거나 쉬는 날' : '조건에 맞는 메뉴가 없어요'}
          </h3>
          {slot.locked && <span className="text-xs font-semibold text-brand-700">고정한 메뉴</span>}
        </div>
        {planned && (
          <>
            <p className="mt-1 text-sm leading-6 muted">{slot.components.map((component) => component.title).join(' + ')}</p>
            <p className="mt-2 text-sm leading-6 text-brand-700">{summary.reason || slot.reason}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="포함된 식품군">
              {summary.foodGroups.map((group) => <span key={group.id} className="meal-plan-group">{group.label}</span>)}
            </div>
            <p className="mt-2 text-xs leading-5 muted">{summary.compositionHint}</p>
            <details className="meal-plan-ingredients mt-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">
                재료 확인 · {summary.missingIngredients.length ? `미보유 ${summary.missingIngredients.length}가지` : summary.unverifiedExpiryIngredients?.length ? '기한 확인 필요' : '재료명 일치'} · 수량 확인 필요
              </summary>
              <div className="mt-3 space-y-2 text-sm leading-6">
                {summary.availableIngredients.length > 0 && <p><span className="font-semibold">보유 재료명: </span>{summary.availableIngredients.join(', ')}</p>}
                {summary.missingIngredients.length > 0 && <p><span className="font-semibold">구매·보유 확인: </span>{summary.missingIngredients.join(', ')}</p>}
                {summary.expiringIngredients.length > 0 && <p><span className="font-semibold">식사일에 기한이 가까운 재료: </span>{summary.expiringIngredients.join(', ')}</p>}
                {summary.unverifiedExpiryIngredients?.length > 0 && <p><span className="font-semibold">기한 확인: </span>{summary.unverifiedExpiryIngredients.join(', ')}</p>}
                <p className="muted">재료별 필요량과 실제 분량은 확인되지 않았어요. 여러 날에 같은 재료가 나오면 전체 필요량을 따로 확인해 주세요. 표시된 날짜와 별개로 조리 전 보관 상태도 확인해 주세요.</p>
                <p className="text-xs muted">앱 기본 메뉴를 조합한 식단 초안이에요. 인분별 수량과 영양 수치는 아직 검증하지 않았어요.</p>
              </div>
            </details>
          </>
        )}
        {!planned && <p className="mt-2 text-sm leading-6 muted">{slot.reason || '이 날은 메뉴 추천에서 제외했어요.'}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {planned && (
            <>
              <button className="meal-plan-action" type="button" disabled={disabled || slot.locked} onClick={onReplace}>메뉴 교체</button>
              <button className="meal-plan-action" type="button" disabled={disabled} aria-pressed={slot.locked} onClick={onLock}>{slot.locked ? '고정 해제' : '메뉴 고정'}</button>
            </>
          )}
          <button className="meal-plan-action" type="button" disabled={disabled || slot.locked} onClick={onSkip}>{slot.status === 'skipped' ? '식단에 포함' : '외식·건너뛰기'}</button>
        </div>
      </div>
    </article>
  );
}

function MealPlanEditor({ plan, weekStart, storageScope, saving, savePlan, ingredients, inventoryLoading, inventoryError, pantryItems }) {
  const [preferences, setPreferences] = useState(() => plan?.preferences || DEFAULT_PREFERENCES);
  const [excludedText, setExcludedText] = useState(() => preferences.excludedIngredients.join(', '));
  const [notice, setNotice] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(() => !plan);
  const currentPreferences = { ...preferences, excludedIngredients: parseExcludedIngredients(excludedText) };
  const settingsDirty = Boolean(plan) && JSON.stringify(currentPreferences) !== JSON.stringify(plan.preferences);
  const busy = saving || inventoryLoading || Boolean(inventoryError);
  const options = { ingredients, pantryItems };

  async function persist(nextPlan, successMessage) {
    setNotice('');
    const savedPlan = await savePlan(nextPlan);
    if (savedPlan) {
      setPreferences(savedPlan.preferences);
      setExcludedText(savedPlan.preferences.excludedIngredients.join(', '));
      setNotice(successMessage);
    }
    return savedPlan;
  }

  async function handleGenerate(event) {
    event.preventDefault();
    if (busy) return;
    const nextPlan = generateMealPlan({
      weekStart,
      scope: storageScope,
      preferences: currentPreferences,
      ...options,
      previousPlan: plan
    });
    const savedPlan = await persist(nextPlan, '이 기기에 저장됨 · 재료와 분량을 확인해 주세요.');
    if (savedPlan) setSettingsOpen(false);
  }

  async function handleReplace(slot) {
    const nextPlan = replaceMealPlanSlot(plan, slot.id, options);
    const nextSlot = nextPlan.slots.find((item) => item.id === slot.id);
    if (nextSlot.templateKey === slot.templateKey) {
      setNotice('지금 조건에 맞는 다른 메뉴가 없어요. 피하고 싶은 재료를 조정해 보세요.');
      return;
    }
    await persist(nextPlan, `${shortDate(slot.date)} 메뉴를 바꿨어요.`);
  }

  return (
    <>
      <form className="meal-plan-settings" onSubmit={handleGenerate}>
        <details open={settingsOpen} onToggle={(event) => setSettingsOpen(event.currentTarget.open)}>
          <summary className="cursor-pointer text-base font-semibold text-slate-900">
            식단 조건 <span className="ml-2 text-sm font-normal muted">{preferences.servings}인 · 집밥 {preferences.dinnerDays.length}일</span>
          </summary>
        <fieldset disabled={busy} className="mt-4 min-w-0">
          <legend className="sr-only">어떤 저녁을 준비할까요?</legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <label className="text-sm font-medium" htmlFor="meal-plan-servings">식사 인원
              <select id="meal-plan-servings" className="mt-2" value={preferences.servings} onChange={(event) => setPreferences({ ...preferences, servings: Number(event.target.value) })}>
                <option value="1">1인</option><option value="2">2인</option>
              </select>
            </label>
            <label className="text-sm font-medium" htmlFor="meal-plan-excluded">피하고 싶은 재료
              <input id="meal-plan-excluded" className="mt-2" value={excludedText} maxLength={240} placeholder="예: 버섯, 가지" aria-describedby="meal-plan-excluded-help" onChange={(event) => setExcludedText(event.target.value)} />
            </label>
          </div>
          <p id="meal-plan-excluded-help" className="mt-2 text-xs leading-5 muted">쉼표로 구분해 주세요. 취향을 반영하는 기능이며, 알레르기 안전성을 보장하는 필터는 아니에요.</p>
          <fieldset className="mt-4">
            <legend className="mb-2 text-sm font-medium">집에서 저녁 먹는 날</legend>
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {DAYS.map((day, index) => (
                <label key={day} className={`meal-plan-day-choice ${preferences.dinnerDays.includes(index) ? 'is-selected' : ''}`}>
                  <input type="checkbox" aria-label={`${day}요일 저녁`} checked={preferences.dinnerDays.includes(index)} onChange={(event) => {
                    const dinnerDays = event.target.checked ? [...preferences.dinnerDays, index].sort() : preferences.dinnerDays.filter((value) => value !== index);
                    setPreferences({ ...preferences, dinnerDays });
                  }} />
                  <span>{day}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </fieldset>
        </details>
        <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-sm text-xs leading-5 muted">{plan ? '고정한 메뉴는 유지해요. 조건을 바꾸면 고정 메뉴도 직접 확인해 주세요.' : '재료가 없어도 초안을 만들 수 있어요. 필요한 재료를 함께 안내해 드려요.'}</p>
          <button className="btn-primary w-full shrink-0 sm:w-auto" type="submit" disabled={busy}>{saving ? '저장 중…' : plan ? '고정하지 않은 메뉴 다시 추천' : '한 주 식단 만들기'}</button>
        </div>
      </form>

      {inventoryError && <p role="alert" className="text-sm text-red-800">재료를 불러오지 못했어요. 기존 식단은 유지돼요. <Link to="/ingredients" className="underline">냉장고에서 확인해 주세요.</Link></p>}
      {inventoryLoading && <p className="text-sm muted">냉장고 재료를 확인하고 있어요.</p>}
      {settingsDirty && <p className="text-sm text-amber-900">조건이 변경됐어요. 다시 추천을 눌러 저장한 뒤 날짜별 메뉴를 편집해 주세요.</p>}
      <p role="status" aria-live="polite" className="text-sm text-brand-700">{saving ? '식단을 저장하고 있어요.' : notice || (plan ? '이 기기에 저장됨' : '')}</p>

      {plan ? (
        <section className="meal-plan-board" aria-label="한 주 저녁 식단표">
          {plan.slots.map((slot, index) => (
            <MealSlot key={slot.id} slot={slot} dayIndex={index} ingredients={inventoryError ? [] : ingredients} pantryItems={pantryItems} disabled={busy || settingsDirty}
              onReplace={() => handleReplace(slot)}
              onLock={() => persist(toggleMealPlanSlotLock(plan, slot.id), slot.locked ? '메뉴 고정을 해제했어요.' : '다시 추천해도 이 메뉴는 유지해요.')}
              onSkip={() => persist(setMealPlanSlotSkipped(plan, slot.id, slot.status !== 'skipped', options), slot.status === 'skipped' ? '식단에 다시 포함했어요.' : '이 날의 저녁은 건너뛰어요.')}
            />
          ))}
        </section>
      ) : (
        <section className="meal-plan-empty" aria-label="아직 식단이 없어요">
          <div aria-hidden="true" className="mb-5 grid w-full max-w-sm grid-cols-7 border-y border-brand-100 py-4">
            {DAYS.map((day) => <div key={day} className="border-r border-brand-100 text-center last:border-0"><span className="text-xs text-brand-700">{day}</span><div className="mt-4 text-xl text-brand-500">—</div></div>)}
          </div>
          <h2 className="text-lg font-semibold text-slate-900">이번 주 메뉴 고민, 여기서 시작해요</h2>
          <p className="mt-2 max-w-md text-sm leading-6 muted">먹을 날을 고르면 냉장고 재료를 우선해서 제안해요. 마음에 들지 않는 메뉴는 하나씩 바꿀 수 있어요.</p>
          <Link to="/ingredients" className="mt-4 text-sm font-semibold text-brand-700 underline underline-offset-4">냉장고 재료부터 확인하기</Link>
        </section>
      )}
    </>
  );
}

function MealPlanWorkspace() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const { plan, loading, ready, saving, error, savePlan, retryLoad, storageScope } = useMealPlan(weekStart);
  const { ingredients, loading: inventoryLoading, error: inventoryError } = useIngredients();
  const { pantryStaples, pantryOwnership } = usePantryStaples();
  const pantryItems = useMemo(() => pantryStaples.filter((item) => pantryOwnership[item.id] === PANTRY_STATUS.OWNED).map((item) => item.name), [pantryStaples, pantryOwnership]);

  return (
    <div className="meal-plan-page section-shell mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-10">
      <header className="pb-1 pt-2">
        <p className="kicker">우리 집 저녁 식단</p>
        <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-slate-950 sm:text-3xl">이번 주 저녁, 미리 골라두세요</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 muted">냉장고에 있는 재료와 우리 집 취향으로 한 주를 채워요. 마음에 드는 날은 고정하고, 나머지는 가볍게 바꿔보세요.</p>
      </header>

      <div className="meal-plan-week-nav">
        <div className="flex items-center gap-2">
          <button className="meal-plan-action" type="button" aria-label="이전 주" disabled={saving} onClick={() => setWeekStart(addCalendarDays(weekStart, -7))}>←</button>
          <h2 className="whitespace-nowrap text-lg font-semibold tabular-nums">{shortDate(weekStart)} — {shortDate(addCalendarDays(weekStart, 6))}</h2>
          <button className="meal-plan-action" type="button" aria-label="다음 주" disabled={saving} onClick={() => setWeekStart(addCalendarDays(weekStart, 7))}>→</button>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <label htmlFor="meal-plan-week" className="sr-only">주 시작일</label>
          <input id="meal-plan-week" className="min-w-0 sm:max-w-[10rem]" type="date" value={weekStart} disabled={saving} onChange={(event) => {
            if (event.target.value) setWeekStart(getWeekStart(new Date(`${event.target.value}T12:00:00`)));
          }} />
          <button className="meal-plan-action shrink-0" type="button" disabled={saving} onClick={() => setWeekStart(getWeekStart())}>이번 주</button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900"><p>{error}</p><button type="button" className="mt-2 underline" disabled={saving || loading} onClick={retryLoad}>저장된 식단 다시 불러오기</button></div>}
      {loading ? <p className="py-12 text-center text-sm muted" role="status">식단을 불러오는 중이에요.</p> : ready && (
        <MealPlanEditor key={`${storageScope}:${weekStart}`} {...{ plan, weekStart, storageScope, saving, savePlan, ingredients, inventoryLoading, inventoryError, pantryItems }} />
      )}

      <aside className="border-t border-brand-100 pt-5 text-xs leading-6 muted" aria-label="식단 이용 안내">
        <p>식품군은 메뉴에 포함된 재료 구성을 알려줘요. 하루 영양 충족이나 건강 효과를 평가하지 않으며, 열량·탄단지 계산은 아직 제공하지 않아요.</p>
        <p className="mt-1">식단은 현재 브라우저에만 저장돼요. 게스트와 로그인 계정별로 분리되며, 다른 기기 동기화·백업 내보내기에는 포함되지 않아요. 식단을 편집해도 냉장고 수량과 기존 장보기 목록은 바뀌지 않아요.</p>
      </aside>
    </div>
  );
}

export default function MealPlanPage() {
  const { storageScope, loading } = useAuth();
  if (loading) return <p className="py-12 text-center text-sm muted" role="status">계정 정보를 확인하고 있어요.</p>;
  return <MealPlanWorkspace key={storageScope} />;
}
