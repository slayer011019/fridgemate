import { pantryStaples, PANTRY_STATUS } from '../../../src/data/pantryStaples.js';
import { normalizeIngredientName } from '../../../src/features/ingredients/ingredientDomain.js';
import { withUserDatabaseScope } from '../db/tenantScope.js';
import { createHttpError } from '../lib/httpError.js';

const PANTRY_IDS = new Set(pantryStaples.map((item) => item.id));
const PANTRY_STATUSES = new Set(Object.values(PANTRY_STATUS));
const PREFERENCE_FIELDS = new Set([
  'preferredIngredients',
  'dislikedIngredients',
  'spiceLevel',
  'cookingTimePreference'
]);
const SPICE_LEVELS = new Set(['mild', 'medium', 'spicy']);
const COOKING_TIMES = new Set(['quick', 'flexible', 'leisurely']);

function normalizeString(value, name, maxLength = 100) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result || result.length > maxLength) {
    throw createHttpError(400, `${name} is invalid.`);
  }
  return result;
}

function normalizeIngredientList(value, name) {
  if (!Array.isArray(value) || value.length > 50) {
    throw createHttpError(400, `${name} must be an array with at most 50 items.`);
  }
  return [...new Set(value.map((item) => normalizeIngredientName(normalizeString(item, name))).filter(Boolean))];
}

export function normalizePantryOwnershipInput(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => key !== 'items')) {
    throw createHttpError(400, 'Pantry ownership payload is invalid.');
  }
  if (!Array.isArray(body.items) || body.items.length > pantryStaples.length) {
    throw createHttpError(400, 'items must be a bounded array.');
  }
  const seen = new Set();
  return body.items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw createHttpError(400, 'Pantry item is invalid.');
    }
    if (Object.keys(item).some((key) => key !== 'stapleId' && key !== 'status')) {
      throw createHttpError(400, 'Pantry item contains unsupported fields.');
    }
    const stapleId = normalizeString(item.stapleId, 'stapleId', 64);
    const status = normalizeString(item.status, 'status', 16);
    if (!PANTRY_IDS.has(stapleId) || !PANTRY_STATUSES.has(status) || seen.has(stapleId)) {
      throw createHttpError(400, 'Pantry item is not supported.');
    }
    seen.add(stapleId);
    return { stapleId, status };
  });
}

export function normalizeUserPreferenceInput(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createHttpError(400, 'Preference payload is invalid.');
  }
  if (Object.keys(body).some((key) => !PREFERENCE_FIELDS.has(key))) {
    throw createHttpError(400, 'Preference payload contains unsupported fields.');
  }
  const spiceLevel = normalizeString(body.spiceLevel, 'spiceLevel', 16);
  const cookingTimePreference = normalizeString(body.cookingTimePreference, 'cookingTimePreference', 16);
  if (!SPICE_LEVELS.has(spiceLevel) || !COOKING_TIMES.has(cookingTimePreference)) {
    throw createHttpError(400, 'Preference option is not supported.');
  }
  return {
    preferredIngredients: normalizeIngredientList(body.preferredIngredients, 'preferredIngredients'),
    dislikedIngredients: normalizeIngredientList(body.dislikedIngredients, 'dislikedIngredients'),
    spiceLevel,
    cookingTimePreference
  };
}

export function listPantryOwnership(userId) {
  return withUserDatabaseScope(userId, (database) =>
    database.pantryOwnership.findMany({ where: { userId }, orderBy: { stapleId: 'asc' } })
  );
}

export async function savePantryOwnership(userId, body) {
  const items = normalizePantryOwnershipInput(body);
  return withUserDatabaseScope(userId, async (database) => {
    for (const item of items) {
      await database.pantryOwnership.upsert({
        where: { userId_stapleId: { userId, stapleId: item.stapleId } },
        create: { ...item, userId },
        update: { status: item.status }
      });
    }
    return database.pantryOwnership.findMany({ where: { userId }, orderBy: { stapleId: 'asc' } });
  });
}

export async function getUserPreference(userId) {
  return withUserDatabaseScope(userId, async (database) => {
    const preference = await database.userPreference.findUnique({ where: { userId } });
    return preference || {
      preferredIngredients: [],
      dislikedIngredients: [],
      spiceLevel: 'medium',
      cookingTimePreference: 'flexible',
      userId
    };
  });
}

export async function saveUserPreference(userId, body) {
  const preference = normalizeUserPreferenceInput(body);
  return withUserDatabaseScope(userId, (database) =>
    database.userPreference.upsert({
      where: { userId },
      create: { ...preference, userId },
      update: preference
    })
  );
}
