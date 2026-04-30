import { normalizeIngredientName } from '../../../src/features/ingredients/ingredientDomain.js';
import { generateRecipeSearchLinks } from '../../../src/features/recipes/recipeSearchLinks.js';
import { generateRecipeEmbedding } from './recipeEmbeddingService.js';

function clampLimit(limit) {
  const parsed = Number(limit);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(100, Math.floor(parsed))) : 20;
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
  const names = [
    ...new Set(
      userIngredients
        .map((ingredient) =>
          typeof ingredient === 'string'
            ? String(ingredient || '').trim()
            : String(ingredient?.name || ingredient?.normalizedName || '').trim()
        )
        .map((name) => name || normalizeIngredientName(name))
        .filter(Boolean)
    )
  ];

  return `보유 재료: ${names.join(', ')}. 만들 수 있는 집밥 메뉴 추천.`;
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
  const embedding = await (options.generateEmbedding || generateRecipeEmbedding)(queryText);
  const vectorLiteral = vectorToSqlLiteral(embedding);
  const safeLimit = clampLimit(limit);
  const rows = await prismaClient.$queryRawUnsafe(
    `
      SELECT
        id,
        name,
        category,
        cooking_method,
        raw_ingredients_text,
        1 - (embedding <=> $1::vector) AS "vectorScore"
      FROM recipes
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT ${safeLimit}
    `,
    vectorLiteral
  );

  return rows.map(mapVectorRow);
}
