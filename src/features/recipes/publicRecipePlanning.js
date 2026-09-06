import {
  getPublicRecipeBySlug,
  getPublicRecipePath,
  getRecipeIngredientLines,
  publicRecipeCatalog
} from './publicRecipeCatalog.js';
import { getRecipeEditorial } from './recipeEditorialContent.js';

const MAX_PLANNING_INGREDIENTS = 12;
const MAX_INGREDIENT_NAME_LENGTH = 40;
const MFDS_SOURCES = new Set(['mfds_cookrcp01', 'mfds', 'food_safety_korea', '식품의약품안전처 조리식품의 레시피 db']);

// Planning compares the exact ingredient requested by the source recipe.
// Broad recommendation aliases (e.g. tofu and soft tofu) are unsuitable here.
function normalizePlanningName(value) {
  const name = String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/gu, '');
  return name === '계란' ? '달걀' : name;
}

export function parsePlanningIngredients(value) {
  if (typeof value !== 'string') return [];
  const seen = new Set();
  const names = [];

  for (const part of value.split(',')) {
    const name = part.normalize('NFKC').trim().replace(/\s+/gu, ' ');
    if (!name || name.length > MAX_INGREDIENT_NAME_LENGTH || !/^[\p{L}\p{N} ()·'’-]+$/u.test(name)) continue;
    const key = normalizePlanningName(name);
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length === MAX_PLANNING_INGREDIENTS) break;
  }

  return names;
}

export function getRecipePreparationItems(recipe) {
  const publicRecipe = getPublicRecipeForRecommendation(recipe);
  const editorial = publicRecipe ? getRecipeEditorial(publicRecipe) : null;
  const recipeId = String(recipe?.externalId || 'recipe');

  if (editorial) {
    return editorial.ingredients.map((item, index) => ({
      id: `${recipeId}:ingredient:${index}`,
      name: item.name,
      amount: item.amount,
      aliases: [...(item.aliases || [])],
      role: item.role,
      automatic: true
    }));
  }

  // Until the source has been reviewed, preserve each complete original line.
  // Splitting on commas can confuse quantities, subrecipes, and alternatives.
  return getRecipeIngredientLines(recipe).map((line, index) => ({
    id: `${recipeId}:line:${index}`,
    name: line,
    amount: '',
    aliases: [],
    role: 'manual',
    automatic: false
  }));
}

export function isPreparationItemOwned(item, names = []) {
  if (!item?.automatic || !Array.isArray(names)) return false;
  const owned = new Set(names.map(normalizePlanningName).filter(Boolean));
  return [item.name, ...(item.aliases || [])].some((name) => {
    const normalizedName = normalizePlanningName(name);
    return normalizedName && owned.has(normalizedName);
  });
}

export function getPublicRecipeForRecommendation(recipe) {
  if (!recipe || typeof recipe !== 'object') return null;
  if (recipe.publicRecipeSlug) return getPublicRecipeBySlug(recipe.publicRecipeSlug);
  if (recipe.publicRecipeId) {
    return publicRecipeCatalog.find((item) => item.externalId === String(recipe.publicRecipeId)) || null;
  }

  const source = String(recipe.source || '').normalize('NFKC').trim().toLowerCase();
  if (!MFDS_SOURCES.has(source) || !recipe.externalId) return null;
  return publicRecipeCatalog.find((item) => item.externalId === String(recipe.externalId)) || null;
}

export function getPlanningRecipePath(recipe, names = []) {
  const publicRecipe = getPublicRecipeForRecommendation(recipe);
  if (!publicRecipe) return '';
  const pathname = getPublicRecipePath(publicRecipe);
  const safeNames = parsePlanningIngredients(Array.isArray(names) ? names.join(',') : names);
  if (!safeNames.length) return pathname;
  return `${pathname}?have=${encodeURIComponent(safeNames.join(','))}`;
}
