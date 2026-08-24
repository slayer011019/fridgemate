import { prisma } from '../db/prisma.js';
import { createHttpError } from '../lib/httpError.js';

const VALID_EVENT_TYPES = new Set(['impression', 'click']);
const ROOT_FIELDS = new Set([
  'eventType',
  'recipeId',
  'sessionId',
  'rank',
  'score',
  'matchRate',
  'missingIngredientCount',
  'urgentMatchCount',
  'canMakeNow',
  'source',
  'metadata'
]);
const METADATA_FIELDS = new Set(['recipeName', 'group']);
const VALID_SOURCES = new Set(['rule', 'hybrid']);
const VALID_GROUPS = new Set(['ready', 'buyOneMore', 'useSoon']);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function rejectUnknownFields(value, allowedFields, label) {
  const unknownFields = Object.keys(value).filter((field) => !allowedFields.has(field));

  if (unknownFields.length) {
    throw createHttpError(400, `${label} contains unsupported fields.`);
  }
}

function requiredString(value, { name, maxLength }) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw createHttpError(400, `${name} must be a non-empty string of at most ${maxLength} characters.`);
  }

  return value.trim();
}

function optionalString(value, { name, maxLength, pattern }) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const normalized = requiredString(value, { name, maxLength });

  if (pattern && !pattern.test(normalized)) {
    throw createHttpError(400, `${name} has an invalid format.`);
  }

  return normalized;
}

function optionalNumber(value, { name, min, max, integer = false }) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw createHttpError(400, `${name} must be a number between ${min} and ${max}.`);
  }

  if (integer && !Number.isInteger(value)) {
    throw createHttpError(400, `${name} must be an integer.`);
  }

  return value;
}

function optionalBoolean(value, name) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'boolean') {
    throw createHttpError(400, `${name} must be a boolean.`);
  }

  return value;
}

function optionalEnum(value, { name, values }) {
  const normalized = optionalString(value, { name, maxLength: 64 });

  if (normalized !== null && !values.has(normalized)) {
    throw createHttpError(400, `${name} is not supported.`);
  }

  return normalized;
}

function normalizeMetadata(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (!isPlainObject(value)) {
    throw createHttpError(400, 'metadata must be an object.');
  }

  rejectUnknownFields(value, METADATA_FIELDS, 'metadata');
  const metadata = {
    recipeName: optionalString(value.recipeName, { name: 'metadata.recipeName', maxLength: 200 }),
    group: optionalEnum(value.group, { name: 'metadata.group', values: VALID_GROUPS })
  };

  return Object.values(metadata).some((item) => item !== null) ? metadata : null;
}

export function normalizeRecommendationEventPayload(body = {}) {
  if (!isPlainObject(body)) {
    throw createHttpError(400, 'Recommendation event payload must be an object.');
  }

  rejectUnknownFields(body, ROOT_FIELDS, 'Recommendation event payload');
  const eventType = requiredString(body.eventType, { name: 'eventType', maxLength: 16 });

  if (!VALID_EVENT_TYPES.has(eventType)) {
    throw createHttpError(400, 'eventType must be "impression" or "click".');
  }

  return {
    eventType,
    recipeId: requiredString(body.recipeId, { name: 'recipeId', maxLength: 200 }),
    sessionId: optionalString(body.sessionId, {
      name: 'sessionId',
      maxLength: 128,
      pattern: /^[A-Za-z0-9-]+$/
    }),
    rank: optionalNumber(body.rank, { name: 'rank', min: 1, max: 1000, integer: true }),
    score: optionalNumber(body.score, { name: 'score', min: -10_000, max: 10_000 }),
    matchRate: optionalNumber(body.matchRate, { name: 'matchRate', min: 0, max: 100 }),
    missingIngredientCount: optionalNumber(body.missingIngredientCount, {
      name: 'missingIngredientCount',
      min: 0,
      max: 1000,
      integer: true
    }),
    urgentMatchCount: optionalNumber(body.urgentMatchCount, {
      name: 'urgentMatchCount',
      min: 0,
      max: 1000,
      integer: true
    }),
    canMakeNow: optionalBoolean(body.canMakeNow, 'canMakeNow'),
    source: optionalEnum(body.source, { name: 'source', values: VALID_SOURCES }),
    metadata: normalizeMetadata(body.metadata)
  };
}

export async function createRecommendationEvent({ userId = null, body = {} } = {}) {
  const data = normalizeRecommendationEventPayload(body);
  const normalizedUserId = typeof userId === 'string' && userId.trim() ? userId.trim() : null;
  const user = normalizedUserId
    ? await prisma.user.findUnique({
        where: { id: normalizedUserId },
        select: { id: true }
      })
    : null;

  return prisma.recommendationEvent.create({
    data: {
      ...data,
      userId: user?.id || null
    }
  });
}
