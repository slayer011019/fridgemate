import { randomUUID } from 'node:crypto';
import { serverConfig } from '../config.js';
import { prisma } from '../db/prisma.js';
import { createHttpError } from '../lib/httpError.js';
import { createEmbedding, isEmbeddingEnabled, toVectorLiteral } from './embeddingService.js';

const MAX_ITEMS_PER_REQUEST = 30;
const MAX_SUGGESTIONS_PER_ITEM = 3;
const MIN_SIMILARITY = 0.78;

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function getCorrectionSourceText(item) {
  return (
    normalizeText(item?.normalizedName) ||
    normalizeText(item?.displayName) ||
    normalizeText(item?.name) ||
    normalizeText(item?.sourceLine) ||
    normalizeText(item?.rawLine) ||
    normalizeText(item?.originalText)
  );
}

function getCorrectionSourceKey(item) {
  return normalizeKey(getCorrectionSourceText(item));
}

function getEmbeddingText(item) {
  return [
    getCorrectionSourceText(item),
    normalizeText(item?.sourceLine || item?.rawLine || item?.originalText),
    normalizeText(item?.specText || item?.quantity)
  ]
    .filter(Boolean)
    .join(' | ');
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
  const correctedName = normalizeText(item?.name || item?.correctedName);

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

export async function getImportCorrectionSuggestions(userId, items = []) {
  const normalizedItems = items.slice(0, MAX_ITEMS_PER_REQUEST).map(normalizeSuggestionItem).filter((item) => item.id && item.sourceKey);

  if (!normalizedItems.length || !isEmbeddingEnabled()) {
    return {};
  }

  const suggestionsById = {};

  for (const item of normalizedItems) {
    const embedding = await createEmbedding(item.embeddingText);

    if (!embedding) {
      continue;
    }

    const vectorLiteral = toVectorLiteral(embedding);
    const rows = await prisma.$queryRaw`
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
    `;

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

export async function saveImportCorrectionsForUser(userId, items = []) {
  const normalizedItems = items
    .slice(0, MAX_ITEMS_PER_REQUEST)
    .map(normalizeCorrectionItem)
    .filter((item) => item.sourceKey && item.correctedName && item.category && item.storageType);

  if (!normalizedItems.length) {
    throw createHttpError(400, 'At least one import correction is required.');
  }

  for (const item of normalizedItems) {
    let embedding = null;

    if (isEmbeddingEnabled()) {
      embedding = await createEmbedding(item.embeddingText);
    }

    if (embedding?.length) {
      const vectorLiteral = toVectorLiteral(embedding);

      await prisma.$executeRaw`
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
      `;
      continue;
    }

    await prisma.importCorrection.upsert({
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
    });
  }

  return { savedCount: normalizedItems.length };
}
