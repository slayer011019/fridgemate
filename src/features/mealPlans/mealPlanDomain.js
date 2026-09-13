import { normalizeIngredientName } from '../ingredients/ingredientDomain.js';
import { getCompositionHint, getMealFoodGroups } from '../nutrition/foodGroupRules.js';
import { MEAL_PLAN_CATALOG_VERSION, mealPlanCatalog } from './mealPlanCatalog.js';

export { mealPlanCatalog } from './mealPlanCatalog.js';

const ALL_DINNER_DAYS = [0, 1, 2, 3, 4, 5, 6];
const NO_CANDIDATE_REASON = '제외한 재료를 피할 수 있는 메뉴가 없어요. 제외 재료를 조정해 주세요.';
const QUANTITY_CAUTION = '보유 표시는 재료명 기준이며 한 주에 필요한 분량을 보장하지 않아요. 조리 전 수량과 상태를 확인해 주세요.';

function parseCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function formatCalendarDate(date) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addCalendarDays(dateString, numberOfDays) {
  const date = parseCalendarDate(dateString);
  if (!date || !Number.isInteger(numberOfDays)) throw new RangeError('올바른 날짜와 일수가 필요해요.');
  date.setDate(date.getDate() + numberOfDays);
  return formatCalendarDate(date);
}

export function getWeekStart(value = new Date()) {
  const date = typeof value === 'string' ? parseCalendarDate(value) : value instanceof Date ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw new RangeError('올바른 주 시작 날짜가 필요해요.');
  date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  return formatCalendarDate(date);
}

function timestamp(now) {
  const date = now === undefined ? new Date() : new Date(now);
  if (Number.isNaN(date.getTime())) throw new RangeError('올바른 저장 시각이 필요해요.');
  return date.toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizePreferences(preferences = {}) {
  return {
    servings: Number(preferences.servings) === 2 ? 2 : 1,
    excludedIngredients: [...new Set((Array.isArray(preferences.excludedIngredients) ? preferences.excludedIngredients : [])
      .filter((name) => typeof name === 'string')
      .map((name) => name.trim()).filter(Boolean))],
    dinnerDays: [...new Set((Array.isArray(preferences.dinnerDays) ? preferences.dinnerDays : ALL_DINNER_DAYS)
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b),
  };
}

function ingredientKey(name) {
  return normalizeIngredientName(name).replace(/\s+/g, '').toLowerCase();
}

function getExcludedNames(components, excludedIngredients) {
  const excluded = new Set(excludedIngredients.map(ingredientKey));
  // Optional source ingredients are checked too. This is a conservative taste
  // filter, not an allergen screen for packaged sauces or cross-contact.
  return [...new Set(components.flatMap((component) => component.ingredients || [])
    .filter((line) => excluded.has(ingredientKey(line.rawName)))
    .map((line) => line.rawName))];
}

function getNeededNames(components = []) {
  const names = new Map();
  components.forEach((component) => (component.ingredients || []).forEach((line) => {
    if (line.selected && !names.has(ingredientKey(line.rawName))) names.set(ingredientKey(line.rawName), line.rawName);
  }));
  return [...names.values()];
}

function inventoryStatus(date, ingredients, pantryItems) {
  const available = new Set();
  const expiring = new Set();
  const unverifiedExpiry = new Set();
  ingredients.forEach((ingredient) => {
    if (!ingredient || ingredient.consumed || ingredient.deletedAt) return;
    const key = ingredientKey(ingredient.name || ingredient.normalizedName || '');
    if (!key) return;
    const expiry = ingredient.expiryDate;
    if (!parseCalendarDate(expiry)) {
      unverifiedExpiry.add(key);
      return;
    }
    if (expiry < date) return;
    available.add(key);
    if (expiry <= addCalendarDays(date, 3)) expiring.add(key);
  });
  pantryItems.forEach((item) => {
    const name = typeof item === 'string' ? item : item?.name;
    if (name) available.add(ingredientKey(name));
  });
  return { available, expiring, unverifiedExpiry };
}

export function getSlotSummary(slot, ingredients = [], pantryItems = []) {
  const foodGroups = getMealFoodGroups(slot?.components || []);
  const result = {
    availableIngredients: [], missingIngredients: [], expiringIngredients: [], unverifiedExpiryIngredients: [],
    foodGroups, compositionHint: getCompositionHint(foodGroups), quantityStatus: 'unverified',
    quantityCaution: QUANTITY_CAUTION, reason: slot?.notice || slot?.reason || '',
  };
  if (!slot || slot.status !== 'planned' || !parseCalendarDate(slot.date)) return result;

  const state = inventoryStatus(slot.date, ingredients, pantryItems);
  getNeededNames(slot.components).forEach((name) => {
    const key = ingredientKey(name);
    if (state.available.has(key)) result.availableIngredients.push(name);
    else if (state.unverifiedExpiry.has(key)) result.unverifiedExpiryIngredients.push(name);
    else result.missingIngredients.push(name);
    if (state.available.has(key) && state.expiring.has(key)) result.expiringIngredients.push(name);
  });
  const currentReason = result.expiringIngredients.length
    ? `식사일에 기한이 가까운 ${result.expiringIngredients.slice(0, 2).join('·')} 활용을 제안해요. 수량과 상태를 확인해 주세요.`
    : result.availableIngredients.length
      ? `보유한 ${result.availableIngredients.slice(0, 2).join('·')}에 맞춘 메뉴예요. 필요한 분량은 확인해 주세요.`
      : '장보기를 고려한 메뉴 제안이에요. 필요한 재료와 분량을 확인해 주세요.';
  const expiryCaution = result.unverifiedExpiryIngredients.length
    ? ' 기한 미확인 재료는 조리일까지 사용할 수 있는지 확인해 주세요.' : '';
  result.reason = slot.notice || `${currentReason}${expiryCaution}`;
  return result;
}

function eligibleTemplates(preferences) {
  return mealPlanCatalog.filter((candidate) => !getExcludedNames(candidate.components, preferences.excludedIngredients).length);
}

function tieBreaker(key) {
  return [...key].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 0);
}

function chooseTemplate({ date, candidates, ingredients, pantryItems, usedKeys, revision }) {
  return candidates.map((candidate) => {
    const summary = getSlotSummary({ ...candidate, date, status: 'planned' }, ingredients, pantryItems);
    const requiredCount = getNeededNames(candidate.components).length;
    const usedCount = usedKeys.filter((key) => key === candidate.key).length;
    const score = (summary.availableIngredients.length / Math.max(1, requiredCount)) * 100
      + Math.min(summary.expiringIngredients.length, 3) * 15
      - summary.missingIngredients.length * 2
      - usedCount * 85
      + summary.foodGroups.length;
    return { candidate, score, tie: tieBreaker(`${date}:${revision}:${candidate.key}`) };
  }).sort((a, b) => b.score - a.score || a.tie - b.tie)[0]?.candidate || null;
}

function baseSlot(date, servings) {
  return {
    id: `${date}:dinner`, date, mealType: 'dinner', status: 'empty', locked: false,
    servings, templateKey: null, templateVersion: null, title: '', components: [], foodGroups: [], reason: '', notice: null,
  };
}

function plannedSlot(date, servings, candidate, ingredients, pantryItems) {
  if (!candidate) return { ...baseSlot(date, servings), reason: NO_CANDIDATE_REASON };
  const slot = {
    ...baseSlot(date, servings), status: 'planned', templateKey: candidate.key, templateVersion: candidate.version,
    title: candidate.title, components: clone(candidate.components), foodGroups: clone(candidate.foodGroups),
    catalogVersion: candidate.catalogVersion, foodGroupRuleVersion: candidate.foodGroupRuleVersion,
  };
  const summary = getSlotSummary(slot, ingredients, pantryItems);
  slot.reason = summary.reason;
  return slot;
}

export function generateMealPlan({ weekStart, preferences, ingredients = [], pantryItems = [], scope = 'guest', previousPlan = null, now } = {}) {
  const start = getWeekStart(weekStart || new Date());
  const previous = previousPlan?.weekStart === start && previousPlan.scope === scope ? previousPlan : null;
  const normalized = normalizePreferences(preferences || previous?.preferences);
  const revision = (previous?.revision || 0) + 1;
  const updatedAt = timestamp(now);
  const candidates = eligibleTemplates(normalized);
  const preservedSlots = (previous?.slots || []).filter((slot, day) => {
    const explicitlyRestored = normalized.dinnerDays.includes(day) && !previous.preferences.dinnerDays.includes(day);
    return slot.locked || (slot.status === 'skipped' && !explicitlyRestored);
  });
  const usedKeys = preservedSlots.filter((slot) => slot.status === 'planned').map((slot) => slot.templateKey);
  const slots = ALL_DINNER_DAYS.map((day) => {
    const date = addCalendarDays(start, day);
    const preserved = preservedSlots.find((slot) => slot.date === date);
    if (preserved) {
      const slot = { ...clone(preserved), servings: normalized.servings, notice: null };
      const excludedNames = getExcludedNames(slot.components, normalized.excludedIngredients);
      if (slot.locked && excludedNames.length) {
        slot.reason = `고정한 메뉴에 제외 재료(${excludedNames.join('·')})가 있어요. 고정을 풀고 교체해 주세요.`;
        slot.notice = slot.reason;
      } else if (slot.locked && !normalized.dinnerDays.includes(day)) {
        slot.reason = '집에서 먹지 않는 날로 바꿨지만 고정 메뉴를 보존했어요. 원하면 직접 건너뛰어 주세요.';
        slot.notice = slot.reason;
      }
      return slot;
    }
    if (!normalized.dinnerDays.includes(day)) {
      return { ...baseSlot(date, normalized.servings), status: 'skipped', reason: '이날 저녁은 계획에서 건너뛰었어요.' };
    }
    const candidate = chooseTemplate({ date, candidates, ingredients, pantryItems, usedKeys, revision });
    const slot = plannedSlot(date, normalized.servings, candidate, ingredients, pantryItems);
    if (candidate) usedKeys.push(candidate.key);
    return slot;
  });
  return {
    id: `week:${start}`, schemaVersion: 1, catalogVersion: MEAL_PLAN_CATALOG_VERSION,
    scope, weekStart: start, preferences: normalized, slots, revision,
    createdAt: previous?.createdAt || updatedAt, updatedAt,
  };
}

function updateSlot(plan, slotId, transform, now, preferences = plan.preferences) {
  if (!plan.slots.some((slot) => slot.id === slotId)) return plan;
  return {
    ...plan, preferences, slots: plan.slots.map((slot) => slot.id === slotId ? transform(slot) : slot),
    revision: plan.revision + 1, updatedAt: timestamp(now),
  };
}

export function replaceMealPlanSlot(plan, slotId, { ingredients = [], pantryItems = [], now } = {}) {
  const slot = plan.slots.find((item) => item.id === slotId);
  if (!slot) return plan;
  if (slot.locked || slot.status === 'skipped') {
    return updateSlot(plan, slotId, (item) => ({ ...item, notice: item.locked ? '고정을 풀면 다른 메뉴로 바꿀 수 있어요.' : '건너뛰기를 해제하면 메뉴를 고를 수 있어요.' }), now);
  }
  const candidates = eligibleTemplates(plan.preferences).filter((candidate) => candidate.key !== slot.templateKey);
  const candidate = chooseTemplate({
    date: slot.date, candidates, ingredients, pantryItems, revision: plan.revision + 1,
    usedKeys: plan.slots.filter((item) => item.id !== slotId && item.status === 'planned').map((item) => item.templateKey),
  });
  return updateSlot(plan, slotId, (item) => candidate
    ? plannedSlot(item.date, item.servings, candidate, ingredients, pantryItems)
    : { ...item, reason: '현재 조건에 맞는 다른 메뉴가 없어요. 제외 재료를 조정해 주세요.', notice: '현재 조건에 맞는 다른 메뉴가 없어요. 제외 재료를 조정해 주세요.' }, now);
}

export function toggleMealPlanSlotLock(plan, slotId, { now } = {}) {
  const slot = plan.slots.find((item) => item.id === slotId);
  if (!slot || slot.status !== 'planned') return plan;
  return updateSlot(plan, slotId, (item) => ({ ...item, locked: !item.locked, notice: null }), now);
}

export function setMealPlanSlotSkipped(plan, slotId, skipped, { ingredients = [], pantryItems = [], now } = {}) {
  const index = plan.slots.findIndex((item) => item.id === slotId);
  if (index < 0) return plan;
  const dinnerDays = skipped
    ? plan.preferences.dinnerDays.filter((day) => day !== index)
    : [...new Set([...plan.preferences.dinnerDays, index])].sort((a, b) => a - b);
  return updateSlot(plan, slotId, (slot) => {
    if (skipped) return { ...slot, status: 'skipped', locked: false, notice: null, reason: '이날 저녁은 계획에서 건너뛰었어요.' };
    if (slot.templateKey && !getExcludedNames(slot.components, plan.preferences.excludedIngredients).length) {
      return { ...slot, status: 'planned', locked: false, notice: null, reason: '이전에 골랐던 메뉴를 되살렸어요. 재료와 분량을 다시 확인해 주세요.' };
    }
    const candidate = chooseTemplate({
      date: slot.date, candidates: eligibleTemplates(plan.preferences), ingredients, pantryItems,
      usedKeys: plan.slots.filter((item) => item.id !== slotId && item.status === 'planned').map((item) => item.templateKey),
      revision: plan.revision + 1,
    });
    return plannedSlot(slot.date, slot.servings, candidate, ingredients, pantryItems);
  }, now, { ...plan.preferences, dinnerDays });
}
