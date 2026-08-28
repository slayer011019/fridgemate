import {
  classifyRecipeIngredient,
  normalizeRecipeIngredientName
} from '../../../src/features/recipes/recipeIngredientClassification.js';
import { generateRecipeSearchLinks } from '../../../src/features/recipes/recipeSearchLinks.js';
import { generateRecipeEmbedding } from './recipeEmbeddingService.js';

function clampLimit(limit) {
  const parsed = Number(limit);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(100, Math.floor(parsed))) : 20;
}

function getSearchConfig(options = {}) {
  return {
    model: String(options.model || process.env.RECIPE_EMBEDDING_MODEL || 'text-embedding-3-small').trim(),
    dimensions: Number(options.dimensions || process.env.RECIPE_EMBEDDING_DIMENSIONS || 1536)
  };
}

function vectorToSqlLiteral(vector = []) {
  if (!Array.isArray(vector) || !vector.every((value) => Number.isFinite(value))) {
    throw new Error('Vector search requires a numeric embedding vector.');
  }

  return `[${vector.join(',')}]`;
}

async function getPrismaClient(options = {}) {
  if (options.prismaClient) {
    return options.prismaClient;
  }

  const { prisma } = await import('../db/prisma.js');
  return prisma;
}

/**
 * @param {Array<string|{name?: string, normalizedName?: string}>} userIngredients
 * @returns {string}
 */
export function buildRecipeVectorQueryText(userIngredients = []) {
  const classified = userIngredients
    .map((ingredient) => {
      const rawName = typeof ingredient === 'string'
        ? ingredient
        : ingredient?.name || ingredient?.normalizedName || ingredient?.rawName || '';
      const normalizedName = normalizeRecipeIngredientName(rawName);
      const classification = classifyRecipeIngredient({ rawName, normalizedName });
      return { name: normalizedName, type: classification.type };
    })
    .filter((ingredient) => ingredient.name);
  const uniqueSorted = (values) => [...new Set(values)].sort((left, right) => left.localeCompare(right, 'ko'));
  const searchNames = uniqueSorted(
    classified.filter((ingredient) => ['main', 'unknown'].includes(ingredient.type)).map((ingredient) => ingredient.name)
  ).slice(0, 30);
  const seasoningNames = uniqueSorted(
    classified.filter((ingredient) => ingredient.type === 'seasoning').map((ingredient) => ingredient.name)
  ).slice(0, 10);
  const lines = [
    searchNames.length ? `검색재료: ${searchNames.join(', ')}` : '',
    seasoningNames.length ? `양념: ${seasoningNames.join(', ')}` : ''
  ];

  return lines.filter(Boolean).join('\n');
}

function mapVectorRow(row = {}) {
  return {
    recipeId: row.id,
    id: row.id,
    name: row.name,
    category: row.category,
    cookingMethod: row.cooking_method ?? row.cookingMethod ?? '',
    rawIngredientsText: row.raw_ingredients_text ?? row.rawIngredientsText ?? '',
    structuredScore: 0,
    vectorScore: Number(row.vectorScore ?? row.vector_score ?? 0),
    searchLinks: generateRecipeSearchLinks(row.name)
  };
}

/**
 * @param {string} queryText
 * @param {number} [limit]
 * @param {{ prismaClient?: Object, generateEmbedding?: Function }} [options]
 * @returns {Promise<Array<{recipeId: string, name: string, vectorScore: number}>>}
 */
export async function searchSimilarRecipesByVector(queryText, limit = 20, options = {}) {
  const prismaClient = await getPrismaClient(options);
  const { model, dimensions } = getSearchConfig(options);
  const embedding = await (options.generateEmbedding || generateRecipeEmbedding)(queryText, {
    model,
    dimensions
  });

  if (embedding.length !== dimensions) {
    throw new Error(`Recipe query embedding must include ${dimensions} dimensions.`);
  }

  const vectorLiteral = vectorToSqlLiteral(embedding);
  const safeLimit = clampLimit(limit);
  const rows = await prismaClient.$queryRawUnsafe(
    `
      SELECT
        r.id,
        r.name,
        r.dish_type AS category,
        r.cooking_method,
        r.ingredients_text AS raw_ingredients_text,
        1 - (re.embedding <=> $1::vector) AS "vectorScore"
      FROM recipe_embeddings re
      JOIN recipes r ON r.id = re.recipe_id
      WHERE re.embedding_model = $2
        AND re.embedding_dimensions = $3
      ORDER BY re.embedding <=> $1::vector
      LIMIT ${safeLimit}
    `,
    vectorLiteral,
    model,
    dimensions
  );

  return rows.map(mapVectorRow);
}
