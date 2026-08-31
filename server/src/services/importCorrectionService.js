import { randomUUID } from 'node:crypto';
import { serverConfig } from '../config.js';
import { withUserDatabaseScope } from '../db/tenantScope.js';
import { createHttpError } from '../lib/httpError.js';
import {
  EXTERNAL_AI_ACTIONS,
  hasLikelySensitiveExternalAiText
} from '../lib/externalAiPrivacy.js';
import { createEmbedding, isEmbeddingEnabled, toVectorLiteral } from './embeddingService.js';

const MAX_ITEMS_PER_REQUEST = 30;
const MAX_SUGGESTIONS_PER_ITEM = 3;
const MIN_SIMILARITY = 0.78;
const MAX_ID_LENGTH = 120;
const MAX_NAME_LENGTH = 120;
const MAX_CLASSIFICATION_LENGTH = 40;
const ALLOWED_ITEM_KEYS = new Set([
  'id',
  'normalizedName',
  'name',
  'correctedName',
  'category',
  'storageType'
]);
const RAW_RECEIPT_KEYS = new Set([
  'sourceLine',
  'rawLine',
  'originalText',
  'specText',
  'quantity'
]);
function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasControlCharacters(value) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return (code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127;
  });
}

function hasLikelySensitiveText(value) {
  return hasLikelySensitiveExternalAiText(value);
}

function validateTextField(value, field, maxLength, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw createHttpError(400, `${field} is required.`);
    return '';
  }

  if (typeof value !== 'string') {
    throw createHttpError(400, `${field} must be a string.`);
  }

  if (hasControlCharacters(value)) {
    throw createHttpError(400, `${field} contains unsupported control characters.`);
  }

  const normalized = normalizeText(value);
  if (required && !normalized) throw createHttpError(400, `${field} is required.`);
  if (normalized.length > maxLength) throw createHttpError(400, `${field} is too long.`);
  if (hasLikelySensitiveText(normalized)) {
    throw createHttpError(400, 'Import correction fields must not contain personal or receipt-level data.');
  }

  return normalized;
}

function validatePayloadItem(item) {
  if (!isPlainObject(item)) {
    throw createHttpError(400, 'Each import correction must be an object.');
  }

  const keys = Object.keys(item);
  if (keys.some((key) => RAW_RECEIPT_KEYS.has(key))) {
    throw createHttpError(400, 'Raw receipt fields are not accepted for import correction learning.');
  }

  if (keys.some((key) => !ALLOWED_ITEM_KEYS.has(key))) {
    throw createHttpError(400, 'Import correction contains unsupported fields.');
  }

  const id = validateTextField(item.id, 'id', MAX_ID_LENGTH, { required: true });
  if (!/^[A-Za-z0-9:._-]+$/.test(id)) {
    throw createHttpError(400, 'id contains unsupported characters.');
  }

  const normalizedName = validateTextField(
    item.normalizedName || item.name,
    'normalizedName',
    MAX_NAME_LENGTH,
    { required: true }
  );
  const correctedName = validateTextField(
    item.correctedName || item.name,
    'correctedName',
    MAX_NAME_LENGTH
  );
  const category = validateTextField(item.category, 'category', MAX_CLASSIFICATION_LENGTH);
  const storageType = validateTextField(item.storageType, 'storageType', MAX_CLASSIFICATION_LENGTH);

  return { id, normalizedName, correctedName, category, storageType };
}

function validatePayloadItems(items) {
  if (!Array.isArray(items)) throw createHttpError(400, 'items must be an array.');
  if (items.length > MAX_ITEMS_PER_REQUEST) {
    throw createHttpError(400, `A maximum of ${MAX_ITEMS_PER_REQUEST} import corrections is allowed.`);
  }
  return items.map(validatePayloadItem);
}

function getCorrectionSourceText(item) {
  return normalizeText(item?.normalizedName || item?.name);
}

function getCorrectionSourceKey(item) {
  return normalizeKey(getCorrectionSourceText(item));
}

function getEmbeddingText(item) {
  return [
    getCorrectionSourceText(item),
    normalizeText(item?.correctedName),
    normalizeText(item?.category),
    normalizeText(item?.storageType)
  ]
    .filter(Boolean)
    .join(' | ');
}

export function buildSafeImportCorrectionEmbeddingText(correction) {
  if (!isPlainObject(correction)) {
    throw createHttpError(400, 'Import correction must be an object.');
  }

  const sourceText = validateTextField(
    correction.sourceText,
    'sourceText',
    MAX_NAME_LENGTH,
    { required: true }
  );
  const correctedName = validateTextField(
    correction.correctedName,
    'correctedName',
    MAX_NAME_LENGTH,
    { required: true }
  );
  const category = validateTextField(
    correction.category,
    'category',
    MAX_CLASSIFICATION_LENGTH,
    { required: true }
  );
  const storageType = validateTextField(
    correction.storageType,
    'storageType',
    MAX_CLASSIFICATION_LENGTH,
    { required: true }
  );

  return getEmbeddingText({
    normalizedName: sourceText,
    correctedName,
    category,
    storageType
  });
}

function normalizeSuggestionItem(item) {
  return {
    id: String(item?.id || '').trim(),
    sourceKey: getCorrectionSourceKey(item),
    embeddingText: getEmbeddingText(item)
  };
}

function normalizeCorrectionItem(item) {
  const sourceText = getCorrectionSourceText(item);
  const correctedName = normalizeText(item?.correctedName);

  return {
    sourceText,
    sourceKey: normalizeKey(sourceText),
    correctedName,
    category: normalizeText(item?.category),
    storageType: normalizeText(item?.storageType),
    embeddingText: getEmbeddingText({
      ...item,
      normalizedName: sourceText
    })
  };
}

export async function getImportCorrectionSuggestions(userId, items = [], { externalAi } = {}) {
  if (!serverConfig.importCorrectionLearningEnabled) return {};

  const normalizedItems = validatePayloadItems(items).map(normalizeSuggestionItem);

  if (
    !normalizedItems.length ||
    !serverConfig.importCorrectionEmbeddingEnabled ||
    !isEmbeddingEnabled({
      externalAi,
      action: EXTERNAL_AI_ACTIONS.importCorrectionSuggestions
    })
  ) {
    return {};
  }

  const suggestionsById = {};

  for (const item of normalizedItems) {
    const embedding = await createEmbedding(item.embeddingText, {
      externalAi,
      action: EXTERNAL_AI_ACTIONS.importCorrectionSuggestions
    });

    if (!embedding) {
      continue;
    }

    const vectorLiteral = toVectorLiteral(embedding);
    const rows = await withUserDatabaseScope(
      userId,
      (database) => database.$queryRaw`
        SELECT
          "id",
          "sourceText",
          "correctedName",
          "category",
          "storageType",
          "lastUsedAt",
          1 - ("embedding" <=> ${vectorLiteral}::vector) AS "similarity"
        FROM "ImportCorrection"
        WHERE "userId" = ${userId}
          AND "embedding" IS NOT NULL
        ORDER BY "embedding" <=> ${vectorLiteral}::vector
        LIMIT ${MAX_SUGGESTIONS_PER_ITEM}
      `
    );

    const suggestions = rows
      .map((row) => ({
        id: row.id,
        sourceText: row.sourceText,
        correctedName: row.correctedName,
        category: row.category,
        storageType: row.storageType,
        similarity: Number(row.similarity || 0),
        lastUsedAt: row.lastUsedAt
      }))
      .filter((row) => row.similarity >= MIN_SIMILARITY);

    if (suggestions.length) {
      suggestionsById[item.id] = suggestions;
    }
  }

  return suggestionsById;
}

export async function saveImportCorrectionsForUser(userId, items = [], { externalAi } = {}) {
  if (!serverConfig.importCorrectionLearningEnabled) return { savedCount: 0 };

  const normalizedItems = validatePayloadItems(items).map(normalizeCorrectionItem);

  if (
    !normalizedItems.length ||
    normalizedItems.some((item) => !item.sourceKey || !item.correctedName || !item.category || !item.storageType)
  ) {
    throw createHttpError(400, 'At least one import correction is required.');
  }

  for (const item of normalizedItems) {
    let embedding = null;

    if (
      serverConfig.importCorrectionEmbeddingEnabled &&
      isEmbeddingEnabled({
        externalAi,
        action: EXTERNAL_AI_ACTIONS.importCorrectionEmbedding
      })
    ) {
      embedding = await createEmbedding(item.embeddingText, {
        externalAi,
        action: EXTERNAL_AI_ACTIONS.importCorrectionEmbedding
      });
    }

    if (embedding?.length) {
      const vectorLiteral = toVectorLiteral(embedding);

      await withUserDatabaseScope(
        userId,
        (database) => database.$executeRaw`
          INSERT INTO "ImportCorrection" (
            "id",
            "userId",
            "sourceKey",
            "sourceText",
            "correctedName",
            "category",
            "storageType",
            "usageCount",
            "lastUsedAt",
            "embeddingText",
            "embeddingModel",
            "embeddingDimensions",
            "embedding",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            ${randomUUID()},
            ${userId},
            ${item.sourceKey},
            ${item.sourceText},
            ${item.correctedName},
            ${item.category},
            ${item.storageType},
            1,
            now(),
            ${item.embeddingText},
            ${serverConfig.embeddingModel},
            ${serverConfig.embeddingDimensions},
            ${vectorLiteral}::vector,
            now(),
            now()
          )
          ON CONFLICT ("userId", "sourceKey")
          DO UPDATE SET
            "sourceText" = EXCLUDED."sourceText",
            "correctedName" = EXCLUDED."correctedName",
            "category" = EXCLUDED."category",
            "storageType" = EXCLUDED."storageType",
            "usageCount" = "ImportCorrection"."usageCount" + 1,
            "lastUsedAt" = now(),
            "embeddingText" = EXCLUDED."embeddingText",
            "embeddingModel" = EXCLUDED."embeddingModel",
            "embeddingDimensions" = EXCLUDED."embeddingDimensions",
            "embedding" = EXCLUDED."embedding",
            "updatedAt" = now()
        `
      );
      continue;
    }

    await withUserDatabaseScope(userId, (database) =>
      database.importCorrection.upsert({
        where: {
          userId_sourceKey: {
            userId,
            sourceKey: item.sourceKey
          }
        },
        create: {
          userId,
          sourceKey: item.sourceKey,
          sourceText: item.sourceText,
          correctedName: item.correctedName,
          category: item.category,
          storageType: item.storageType,
          embeddingText: item.embeddingText,
          embeddingModel: serverConfig.embeddingModel,
          embeddingDimensions: serverConfig.embeddingDimensions
        },
        update: {
          sourceText: item.sourceText,
          correctedName: item.correctedName,
          category: item.category,
          storageType: item.storageType,
          usageCount: {
            increment: 1
          },
          lastUsedAt: new Date(),
          embeddingText: item.embeddingText,
          embeddingModel: serverConfig.embeddingModel,
          embeddingDimensions: serverConfig.embeddingDimensions
        }
      })
    );
  }

  return { savedCount: normalizedItems.length };
}
