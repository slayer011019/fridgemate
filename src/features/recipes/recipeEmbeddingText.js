import {
  classifyRecipeIngredient,
  dedupeRecipeIngredients,
  normalizeRecipeIngredientName
} from './recipeIngredientClassification.js';

export const RECIPE_EMBEDDING_TEXT_MAX_CHARS = 1200;

function normalizeText(value) {
  return String(value || '')
    .replace(/<[^>]*>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function uniqueSorted(values = []) {
  return [...new Set(values.map(normalizeText).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'ko'));
}

function readTags(recipe = {}) {
  if (Array.isArray(recipe.tags)) return recipe.tags;

  return String(recipe.hashTag || recipe.hash_tag || '')
    .split(/[#,,]/u)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function mapIngredient(ingredient = {}, recipeName = '') {
  const normalizedName = normalizeRecipeIngredientName(
    ingredient.canonicalName ||
      ingredient.canonical_name ||
      ingredient.normalizedName ||
      ingredient.normalized_name ||
      ingredient.rawName ||
      ingredient.raw_name ||
      ingredient.rawText ||
      ingredient.raw_text
  );
  const classification = classifyRecipeIngredient({
    ingredientType: ingredient.ingredientType || ingredient.ingredient_type,
    category: ingredient.category,
    section: ingredient.section,
    rawText: ingredient.rawText || ingredient.raw_text,
    rawName: ingredient.rawName || ingredient.raw_name,
    normalizedName,
    canonicalName: ingredient.canonicalName || ingredient.canonical_name,
    recipeName,
    amount: ingredient.amountValue ?? ingredient.amount,
    unit: ingredient.amountUnit || ingredient.unit
  });

  return {
    ...ingredient,
    normalizedName,
    ingredientType: classification.type,
    classificationConfidence: classification.confidence,
    classificationReason: classification.reason
  };
}

function buildListLine(label, ingredients, types, limit) {
  const names = ingredients
    .filter((ingredient) => types.includes(ingredient.ingredientType))
    .map((ingredient) => ingredient.normalizedName)
    .slice(0, limit);

  return names.length ? `${label}: ${names.join(', ')}` : '';
}

function buildSearchIngredientLine(ingredients) {
  const names = ingredients
    .filter((ingredient) => ['main', 'unknown'].includes(ingredient.ingredientType))
    .map((ingredient) => ingredient.normalizedName)
    .slice(0, 24);
  return names.length ? `검색재료: ${names.join(', ')}` : '';
}

function clampText(lines, maxChars) {
  const output = [];

  for (const line of lines.filter(Boolean)) {
    const prefix = output.length ? '\n' : '';
    const remaining = maxChars - output.join('\n').length - prefix.length;
    if (remaining <= 0) break;
    output.push(line.length <= remaining ? line : line.slice(0, remaining).trimEnd());
  }

  return output.join('\n');
}

/**
 * Builds deterministic, classification-aware text for recipe embeddings.
 *
 * @param {Object} recipe
 * @param {Array<Object>} ingredients
 * @param {{maxChars?: number}} options
 * @returns {string}
 */
export function buildClassifiedRecipeEmbeddingText(recipe = {}, ingredients = [], options = {}) {
  const name = normalizeText(recipe.name || recipe.title);
  const category = normalizeText(recipe.category || recipe.dishType || recipe.dish_type);
  const cookingMethod = normalizeText(recipe.cookingMethod || recipe.cooking_method);
  const classifiedIngredients = dedupeRecipeIngredients(
    ingredients.map((ingredient) => mapIngredient(ingredient, name)).filter((ingredient) => ingredient.normalizedName)
  );
  const tags = uniqueSorted(readTags(recipe)).slice(0, 8);
  const lines = [
    name ? `메뉴: ${name}` : '',
    category ? `분류: ${category}` : '',
    cookingMethod ? `조리방식: ${cookingMethod}` : '',
    buildSearchIngredientLine(classifiedIngredients),
    buildListLine('핵심재료', classifiedIngredients, ['main'], 12),
    buildListLine('양념', classifiedIngredients, ['seasoning'], 8),
    buildListLine('액체', classifiedIngredients, ['liquid'], 4),
    buildListLine('선택/고명', classifiedIngredients, ['optional', 'garnish'], 6),
    tags.length ? `태그: ${tags.join(', ')}` : ''
  ];

  return clampText(lines, Number(options.maxChars) || RECIPE_EMBEDDING_TEXT_MAX_CHARS);
}

export function classifyRecipeIngredientsForEmbedding(recipe = {}, ingredients = []) {
  const name = normalizeText(recipe.name || recipe.title);
  return dedupeRecipeIngredients(ingredients.map((ingredient) => mapIngredient(ingredient, name)));
}
