import { withUserDatabaseScope } from '../db/tenantScope.js';
import { createHttpError } from '../lib/httpError.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const RECIPE_KEY_PATTERN = /^(catalog|local):(.+)$/u;
const VALID_SOURCES = new Set(['rule', 'hybrid']);
const MAX_DECISION_DATE_OFFSET_MS = 7 * 24 * 60 * 60 * 1000;
const SELECT_FIELDS = new Set([
  'clientId',
  'recipeKey',
  'recipeName',
  'recommendationSource',
  'selectedAt'
]);
const COMPLETE_FIELDS = new Set(['clientId', 'completedAt']);
const CANCEL_FIELDS = new Set(['clientId']);

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createHttpError(400, `${label} must be an object.`);
  }
}

function rejectUnknownFields(value, fields, label) {
  if (Object.keys(value).some((field) => !fields.has(field))) {
    throw createHttpError(400, `${label} contains unsupported fields.`);
  }
}

function requiredString(value, name, maxLength) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  const hasControlCharacters = [...normalized].some((character) => {
    const code = character.charCodeAt(0);
    return (code >= 0 && code <= 31) || code === 127;
  });
  if (!normalized || normalized.length > maxLength || hasControlCharacters) {
    throw createHttpError(400, `${name} must be a non-empty string of at most ${maxLength} characters.`);
  }
  return normalized;
}

function optionalTimestamp(value, name) {
  if (value === undefined || value === null || value === '') return new Date();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createHttpError(400, `${name} must be a valid timestamp.`);
  }
  const now = Date.now();
  if (parsed.getTime() > now + 5 * 60 * 1000 || parsed.getTime() < now - 90 * 24 * 60 * 60 * 1000) {
    throw createHttpError(400, `${name} is outside the supported time window.`);
  }
  return parsed;
}

export function normalizeDecisionDate(value, now = Date.now()) {
  const date = requiredString(value, 'date', 10);
  if (!DATE_PATTERN.test(date)) throw createHttpError(400, 'date must use YYYY-MM-DD.');
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw createHttpError(400, 'date must be a real calendar date.');
  }
  const currentUtcDate = new Date(new Date(now).toISOString().slice(0, 10));
  if (Math.abs(parsed.getTime() - currentUtcDate.getTime()) > MAX_DECISION_DATE_OFFSET_MS) {
    throw createHttpError(400, 'date is outside the supported sync window.');
  }
  return parsed;
}

function parseRecipeKey(value) {
  const recipeKey = requiredString(value, 'recipeKey', 200);
  const match = RECIPE_KEY_PATTERN.exec(recipeKey);
  if (!match || !match[2].trim()) {
    throw createHttpError(400, 'recipeKey must use catalog:<uuid> or local:<id>.');
  }
  if (match[1] === 'catalog' && !UUID_PATTERN.test(match[2])) {
    throw createHttpError(400, 'catalog recipeKey must contain a UUID.');
  }
  return {
    recipeKey,
    catalogRecipeId: match[1] === 'catalog' ? match[2] : null
  };
}

export function normalizeMenuSelection(body = {}) {
  assertPlainObject(body, 'Menu decision');
  rejectUnknownFields(body, SELECT_FIELDS, 'Menu decision');
  const recommendationSource = body.recommendationSource == null
    ? null
    : requiredString(body.recommendationSource, 'recommendationSource', 32);
  if (recommendationSource && !VALID_SOURCES.has(recommendationSource)) {
    throw createHttpError(400, 'recommendationSource is not supported.');
  }
  return {
    clientId: requiredString(body.clientId, 'clientId', 128),
    ...parseRecipeKey(body.recipeKey),
    recipeName: requiredString(body.recipeName, 'recipeName', 200),
    recommendationSource,
    selectedAt: optionalTimestamp(body.selectedAt, 'selectedAt')
  };
}

function normalizeStateChange(body, fields, timestampField) {
  assertPlainObject(body, 'Menu decision state change');
  rejectUnknownFields(body, fields, 'Menu decision state change');
  return {
    clientId: requiredString(body.clientId, 'clientId', 128),
    ...(timestampField ? { [timestampField]: optionalTimestamp(body[timestampField], timestampField) } : {})
  };
}

function serializeMenuDecision(decision) {
  if (!decision) return null;
  return {
    ...decision,
    decisionDate: decision.decisionDate.toISOString().slice(0, 10)
  };
}

async function assertCatalogRecipe(database, catalogRecipeId) {
  if (!catalogRecipeId) return;
  const recipe = await database.recipe.findUnique({ where: { id: catalogRecipeId }, select: { id: true } });
  if (!recipe) throw createHttpError(400, 'Catalog recipe does not exist.');
}

async function findDecision(database, userId, decisionDate) {
  return database.menuDecision.findUnique({
    where: { userId_decisionDate: { userId, decisionDate } }
  });
}

export async function getMenuDecision(userId, date) {
  const decisionDate = normalizeDecisionDate(date);
  return withUserDatabaseScope(userId, async (database) =>
    serializeMenuDecision(await findDecision(database, userId, decisionDate))
  );
}

export async function selectMenuDecision(userId, date, body) {
  const decisionDate = normalizeDecisionDate(date);
  const selection = normalizeMenuSelection(body);
  return withUserDatabaseScope(userId, async (database) => {
    await assertCatalogRecipe(database, selection.catalogRecipeId);
    const data = {
      ...selection,
      decisionDate,
      userId,
      status: 'selected',
      completedAt: null
    };
    const decision = await database.menuDecision.upsert({
      where: { userId_decisionDate: { userId, decisionDate } },
      create: data,
      update: {
        ...selection,
        status: 'selected',
        completedAt: null
      }
    });
    return serializeMenuDecision(decision);
  });
}

async function changeDecisionState(userId, date, body, status) {
  const decisionDate = normalizeDecisionDate(date);
  const normalized = normalizeStateChange(
    body,
    status === 'completed' ? COMPLETE_FIELDS : CANCEL_FIELDS,
    status === 'completed' ? 'completedAt' : null
  );
  return withUserDatabaseScope(userId, async (database) => {
    const existing = await findDecision(database, userId, decisionDate);
    if (!existing) throw createHttpError(404, 'Menu decision not found.');
    if (existing.clientId !== normalized.clientId) {
      throw createHttpError(409, 'The selected menu changed on another device.');
    }
    const decision = await database.menuDecision.update({
      where: { id: existing.id },
      data: {
        status,
        completedAt: status === 'completed' ? normalized.completedAt : null
      }
    });
    return serializeMenuDecision(decision);
  });
}

export function completeMenuDecision(userId, date, body) {
  return changeDecisionState(userId, date, body, 'completed');
}

export function cancelMenuDecision(userId, date, body) {
  return changeDecisionState(userId, date, body, 'cancelled');
}
