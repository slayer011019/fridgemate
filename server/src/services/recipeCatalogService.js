import {
  classifyRecipeIngredient,
  dedupeRecipeIngredients,
  normalizeRecipeIngredientName
} from '../../../src/features/recipes/recipeIngredientClassification.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function clampLimit(limit) {
  const parsed = Number(limit);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(500, Math.floor(parsed))) : 50;
}

function normalizeRecipeId(value) {
  const id = String(value || '').trim();
  return UUID_PATTERN.test(id) ? id : '';
}

function mapIngredientRow(row = {}, recipeName = '') {
  const normalizedName = normalizeRecipeIngredientName(
    row.canonical_name || row.normalized_name || row.raw_name || row.raw_text
  );
  const classification = classifyRecipeIngredient({
    category: row.category,
    rawText: row.raw_text,
    rawName: row.raw_name,
    normalizedName,
    canonicalName: row.canonical_name,
    recipeName,
    amount: row.amount,
    unit: row.unit
  });

  return {
    id: String(row.id || ''),
    rawName: String(row.raw_name || row.raw_text || normalizedName).trim(),
    normalizedName,
    canonicalName: String(row.canonical_name || '').trim(),
    ingredientType: classification.type,
    section: String(row.category || '').trim(),
    classificationConfidence: classification.confidence,
    classificationReason: classification.reason,
    amountValue: row.amount === null || row.amount === undefined ? null : Number(row.amount),
    amountUnit: String(row.unit || '').trim() || null,
    confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence)
  };
}

function mapRecipeRow(row = {}, ingredients = []) {
  return {
    id: String(row.id || ''),
    externalId: String(row.external_id || '').trim(),
    name: String(row.name || '').trim(),
    category: String(row.dish_type || '').trim() || '기타',
    cookingMethod: String(row.cooking_method || '').trim(),
    rawIngredientsText: String(row.ingredients_text || '').trim(),
    source: String(row.source || '').trim(),
    updatedAt: row.updated_at || null,
    ingredients
  };
}

async function fetchIngredientsByRecipeIds(prismaClient, recipeIds, recipeNameById = new Map()) {
  if (!recipeIds.length) return new Map();

  const placeholders = recipeIds.map((_, index) => `$${index + 1}::uuid`).join(', ');
  const rows = await prismaClient.$queryRawUnsafe(
    `
      SELECT
        id,
        recipe_id,
        raw_text,
        raw_name,
        normalized_name,
        canonical_name,
        amount,
        unit,
        category,
        confidence
      FROM recipe_ingredients
      WHERE recipe_id IN (${placeholders})
      ORDER BY recipe_id, id
    `,
    ...recipeIds
  );

  const grouped = rows.reduce((byRecipeId, row) => {
    const recipeId = String(row.recipe_id);
    const ingredients = byRecipeId.get(recipeId) || [];
    const ingredient = mapIngredientRow(row, recipeNameById.get(recipeId) || '');
    if (ingredient.normalizedName) ingredients.push(ingredient);
    byRecipeId.set(recipeId, ingredients);
    return byRecipeId;
  }, new Map());

  return new Map([...grouped.entries()].map(([recipeId, ingredients]) => [recipeId, dedupeRecipeIngredients(ingredients)]));
}

/**
 * Loads production-shaped recipe catalog rows in the same order as recipeIds.
 *
 * @param {Object} prismaClient
 * @param {string[]} recipeIds
 * @returns {Promise<Array<Object>>}
 */
export async function getProductionRecipesByIds(prismaClient, recipeIds = []) {
  const ids = [...new Set(recipeIds.map(normalizeRecipeId).filter(Boolean))];
  if (!ids.length) return [];

  const placeholders = ids.map((_, index) => `$${index + 1}::uuid`).join(', ');
  const rows = await prismaClient.$queryRawUnsafe(
    `
      SELECT id, external_id, name, cooking_method, dish_type, ingredients_text, source, updated_at
      FROM recipes
      WHERE id IN (${placeholders})
    `,
    ...ids
  );
  const recipeNameById = new Map(rows.map((row) => [String(row.id), String(row.name || '')]));
  const ingredientsByRecipeId = await fetchIngredientsByRecipeIds(prismaClient, ids, recipeNameById);
  const recipeById = new Map(
    rows.map((row) => [String(row.id), mapRecipeRow(row, ingredientsByRecipeId.get(String(row.id)) || [])])
  );

  return ids.map((id) => recipeById.get(id)).filter(Boolean);
}

/**
 * Fallback candidate source used when semantic retrieval is unavailable.
 *
 * @param {Object} prismaClient
 * @param {number} limit
 * @returns {Promise<Array<Object>>}
 */
export async function getRecentProductionRecipes(prismaClient, limit = 50) {
  const safeLimit = clampLimit(limit);
  const rows = await prismaClient.$queryRawUnsafe(
    `
      SELECT id, external_id, name, cooking_method, dish_type, ingredients_text, source, updated_at
      FROM recipes
      ORDER BY updated_at DESC, id
      LIMIT ${safeLimit}
    `
  );
  const ids = rows.map((row) => normalizeRecipeId(row.id)).filter(Boolean);
  const recipeNameById = new Map(rows.map((row) => [String(row.id), String(row.name || '')]));
  const ingredientsByRecipeId = await fetchIngredientsByRecipeIds(prismaClient, ids, recipeNameById);

  return rows.map((row) => mapRecipeRow(row, ingredientsByRecipeId.get(String(row.id)) || []));
}
