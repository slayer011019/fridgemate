import { buildClassifiedRecipeEmbeddingText } from '../../../src/features/recipes/recipeEmbeddingText.js';

/**
 * Builds deterministic recipe text from production-shaped recipe rows.
 *
 * @param {Object} recipe
 * @param {Array<Object>} ingredients
 * @returns {string}
 */
export function buildProductionRecipeEmbeddingText(recipe = {}, ingredients = []) {
  return buildClassifiedRecipeEmbeddingText(recipe, ingredients);
}

export function buildRecipeEmbeddingContentHash({ recipe = {}, ingredients = [], createHash }) {
  if (typeof createHash !== 'function') {
    throw new Error('createHash is required to build a recipe embedding content hash.');
  }

  return createHash('sha256')
    .update(buildProductionRecipeEmbeddingText(recipe, ingredients))
    .digest('hex');
}
