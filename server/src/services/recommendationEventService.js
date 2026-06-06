import { prisma } from '../db/prisma.js';
import { createHttpError } from '../lib/httpError.js';

const VALID_EVENT_TYPES = new Set(['impression', 'click']);

function toStringOrNull(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function toFiniteNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toIntegerOrNull(value) {
  const number = toFiniteNumberOrNull(value);
  return number === null ? null : Math.trunc(number);
}

function toBooleanOrNull(value) {
  return typeof value === 'boolean' ? value : null;
}

export function normalizeRecommendationEventPayload(body = {}) {
  const eventType = toStringOrNull(body.eventType);
  const recipeId = toStringOrNull(body.recipeId);

  if (!VALID_EVENT_TYPES.has(eventType)) {
    throw createHttpError(400, 'eventType must be "impression" or "click".');
  }

  if (!recipeId) {
    throw createHttpError(400, 'recipeId is required.');
  }

  return {
    eventType,
    recipeId,
    sessionId: toStringOrNull(body.sessionId),
    rank: toIntegerOrNull(body.rank),
    score: toFiniteNumberOrNull(body.score),
    matchRate: toFiniteNumberOrNull(body.matchRate),
    missingIngredientCount: toIntegerOrNull(body.missingIngredientCount),
    urgentMatchCount: toIntegerOrNull(body.urgentMatchCount),
    canMakeNow: toBooleanOrNull(body.canMakeNow),
    source: toStringOrNull(body.source),
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : null
  };
}

export async function createRecommendationEvent({ userId = null, body = {} } = {}) {
  const data = normalizeRecommendationEventPayload(body);
  const normalizedUserId = toStringOrNull(userId);
  const user = normalizedUserId
    ? await prisma.user.findUnique({
        where: {
          id: normalizedUserId
        },
        select: {
          id: true
        }
      })
    : null;

  return prisma.recommendationEvent.create({
    data: {
      ...data,
      userId: user?.id || null
    }
  });
}
