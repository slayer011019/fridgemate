import { runMealPlanTransaction } from '../../db/indexedDB';

const SCHEMA_VERSION = 1;
const INVALID_DATA_MESSAGE = '저장된 식단 형식을 확인할 수 없습니다. 기존 자료는 지우지 않았습니다.';

function resolveScope(scope = 'guest') {
  const value = typeof scope === 'string' ? scope : scope?.scope;

  // User ids use the same safe characters as their existing ingredient database names.
  if (value !== 'guest' && !/^user:[a-zA-Z0-9_-]+$/.test(value || '')) {
    throw new Error('식단을 저장할 계정을 확인할 수 없습니다. 다시 로그인해주세요.');
  }

  return value;
}

function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function assertWeekStart(weekStart) {
  if (!isDate(weekStart) || new Date(`${weekStart}T12:00:00.000Z`).getUTCDay() !== 1) {
    throw new Error('식단의 시작 날짜를 확인해주세요. 한 주는 월요일부터 시작합니다.');
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isTimestamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}

function isNullableString(value) {
  return value === null || typeof value === 'string';
}

function isNullableAmount(value) {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

function isIngredientLine(line) {
  return isObject(line)
    && typeof line.id === 'string' && typeof line.rawName === 'string' && Boolean(line.rawName.trim())
    && typeof line.normalizedName === 'string' && isNullableString(line.foodCode)
    && isNullableAmount(line.amount) && isNullableString(line.unit) && isNullableString(line.preparationState)
    && typeof line.quantityStatus === 'string' && typeof line.quantityReason === 'string'
    && typeof line.selected === 'boolean' && typeof line.optional === 'boolean'
    && Array.isArray(line.foodGroups) && line.foodGroups.every((group) => typeof group === 'string');
}

function isComponent(component) {
  return isObject(component)
    && typeof component.id === 'string' && typeof component.recipeKey === 'string'
    && typeof component.recipeVersion === 'string' && typeof component.title === 'string'
    && ['staple', 'main', 'side'].includes(component.role)
    && isObject(component.source) && typeof component.source.kind === 'string'
    && typeof component.source.id === 'string' && typeof component.source.name === 'string'
    && isNullableAmount(component.sourceServings) && isNullableAmount(component.servings)
    && typeof component.servingsStatus === 'string'
    && (component.nutrition === null || isObject(component.nutrition))
    && typeof component.nutritionStatus === 'string'
    && Array.isArray(component.ingredients) && component.ingredients.length > 0
    && component.ingredients.every(isIngredientLine);
}

function assertPlan(plan, scope, weekStart) {
  if (!isObject(plan) || plan.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(plan?.schemaVersion > SCHEMA_VERSION
      ? '더 최신 버전에서 저장한 식단입니다. 앱을 새로고침한 뒤 다시 시도해주세요. 기존 자료는 유지됩니다.'
      : INVALID_DATA_MESSAGE);
  }
  if (plan.scope !== scope) throw new Error('다른 계정의 식단은 이 계정에 저장하거나 불러올 수 없습니다.');

  assertWeekStart(plan.weekStart);
  const preferences = plan.preferences;
  const validPreferences = isObject(preferences)
    && [1, 2].includes(preferences.servings)
    && Array.isArray(preferences.excludedIngredients)
    && preferences.excludedIngredients.every((name) => typeof name === 'string')
    && Array.isArray(preferences.dinnerDays)
    && preferences.dinnerDays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    && new Set(preferences.dinnerDays).size === preferences.dinnerDays.length;

  if (plan.weekStart !== weekStart || plan.id !== `week:${weekStart}` || !validPreferences
    || !Number.isSafeInteger(plan.revision) || plan.revision < 1
    || !isTimestamp(plan.createdAt) || !isTimestamp(plan.updatedAt)
    || !Array.isArray(plan.slots) || plan.slots.length !== 7) {
    throw new Error(INVALID_DATA_MESSAGE);
  }

  plan.slots.forEach((slot, index) => {
    const date = new Date(`${weekStart}T12:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + index);
    const expectedDate = date.toISOString().slice(0, 10);
    if (!isObject(slot) || slot.date !== expectedDate || slot.id !== `${expectedDate}:dinner`
      || slot.mealType !== 'dinner' || !['planned', 'skipped', 'empty'].includes(slot.status)
      || typeof slot.locked !== 'boolean' || ![1, 2].includes(slot.servings)
      || !(slot.templateKey === null || typeof slot.templateKey === 'string')
      || !(slot.templateVersion === null || (Number.isSafeInteger(slot.templateVersion) && slot.templateVersion > 0))
      || typeof slot.title !== 'string' || typeof slot.reason !== 'string'
      || !(slot.notice === undefined || isNullableString(slot.notice))
      || !Array.isArray(slot.components) || !slot.components.every(isComponent)
      || !Array.isArray(slot.foodGroups)
      || !slot.foodGroups.every((group) => isObject(group) && typeof group.id === 'string' && typeof group.label === 'string')
      || (slot.status === 'planned' && (!slot.templateKey || !slot.templateVersion || !slot.components.length || !slot.title.trim()))) {
      throw new Error(INVALID_DATA_MESSAGE);
    }
  });
  return plan;
}

export async function getMealPlan(weekStart, scope = 'guest') {
  const resolvedScope = resolveScope(scope);
  assertWeekStart(weekStart);
  const plan = await runMealPlanTransaction('readonly', (store) => store.get(`week:${weekStart}`), resolvedScope);
  return plan === undefined ? null : assertPlan(plan, resolvedScope, weekStart);
}

export async function saveMealPlan(plan, scope = 'guest') {
  const resolvedScope = resolveScope(scope);
  assertPlan(plan, resolvedScope, plan?.weekStart);
  const snapshot = structuredClone(plan);
  let validationError;

  try {
    await runMealPlanTransaction('readwrite', (store, transaction) => {
      const request = store.get(snapshot.id);
      request.onsuccess = () => {
        try {
          const current = request.result;
          if (current !== undefined) {
            assertPlan(current, resolvedScope, snapshot.weekStart);
            if (snapshot.revision <= current.revision) {
              throw new Error('다른 화면에서 식단이 변경됐습니다. 다시 불러온 뒤 수정해주세요.');
            }
          }
          store.put(snapshot);
        } catch (error) {
          validationError = error;
          transaction.abort();
        }
      };
      return request;
    }, resolvedScope);
  } catch (error) {
    throw validationError || error;
  }

  return snapshot;
}

export function clearMealPlans(scope = 'guest') {
  return runMealPlanTransaction('readwrite', (store) => store.clear(), resolveScope(scope));
}
