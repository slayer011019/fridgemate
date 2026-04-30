import { resolveSeasoningPreset } from '../../data/recipeSeasoningPresets';
import { resolveIngredientNames } from './ingredientIdMap';
import { formatCookTimeLabel, getRecipeCategoryLabel, getRecipeDifficultyLabel } from './recipeLabels';

function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function buildRecipeDescription({
  title,
  subcategory,
  keyIngredients,
  pantryIngredients,
  cookTimeMinutes
}) {
  const leadIngredient = keyIngredients[0] || null;
  const pantryCount = pantryIngredients.length;

  if (leadIngredient) {
    return `${leadIngredient}\uB97C \uC911\uC2EC\uC73C\uB85C \uAD6C\uC131\uD55C ${subcategory || title} \uB808\uC2DC\uD53C\uC608\uC694. ${formatCookTimeLabel(
      cookTimeMinutes
    )} \uC815\uB3C4 \uAC78\uB9AC\uBA70 ${pantryCount ? '\uAE30\uBCF8 \uC591\uB150\uACFC \uD568\uAED8 ' : ''}\uBE44\uAD50\uC801 \uBE60\uB974\uAC8C \uD574\uBCFC \uC218 \uC788\uC5B4\uC694.`;
  }

  return `${subcategory || title} \uD750\uB984\uC73C\uB85C \uC815\uB9AC\uD55C \uB808\uC2DC\uD53C\uC608\uC694. ${formatCookTimeLabel(
    cookTimeMinutes
  )} \uB0B4\uC678\uB85C \uD574\uBCFC \uC218 \uC788\uACE0 \uD604\uC7AC \uBCF4\uC720 \uC7AC\uB8CC\uB85C \uBE44\uAD50\uD558\uAE30 \uC27D\uAC8C \uB9DE\uCD94\uC5B4\uB450\uC5C8\uC5B4\uC694.`;
}

function adaptSingleRecipe(recipe) {
  const requiredIngredients = resolveIngredientNames(recipe.required_ingredients || []);
  const optionalIngredients = resolveIngredientNames(recipe.optional_ingredients || []);
  const keyIngredients = resolveIngredientNames(recipe.key_ingredients || []);
  const expiryPriorityIngredients = resolveIngredientNames(recipe.scoring?.expiry_priority_ingredients || []);
  const pantryIngredients = uniqueValues(resolveSeasoningPreset(recipe.seasoning_preset));
  const difficultyLevel = recipe.scoring?.difficulty ?? 1;
  const cookTimeMinutes = recipe.scoring?.cook_time_minutes ?? 20;
  const title = recipe.name_ko || recipe.id;
  const categoryCode = recipe.category || 'uncategorized';
  const category = getRecipeCategoryLabel(categoryCode);

  return {
    id: recipe.id,
    title,
    category,
    categoryCode,
    subcategory: recipe.subcategory || '',
    description: buildRecipeDescription({
      title,
      subcategory: recipe.subcategory,
      keyIngredients,
      pantryIngredients,
      cookTimeMinutes
    }),
    primaryIngredient: keyIngredients[0] || requiredIngredients[0] || '',
    coreIngredients: requiredIngredients,
    requiredIngredients,
    ingredients: requiredIngredients,
    optionalIngredients,
    keyIngredients,
    expiryPriorityIngredients,
    pantryIngredients,
    requiredSeasonings: pantryIngredients,
    seasoningPreset: recipe.seasoning_preset || null,
    minRequiredRatio: recipe.scoring?.min_required_ratio ?? 0.5,
    difficultyLevel,
    difficulty: getRecipeDifficultyLabel(difficultyLevel),
    cookTimeMinutes,
    cookingTime: formatCookTimeLabel(cookTimeMinutes),
    tags: uniqueValues([category, recipe.subcategory].filter(Boolean)),
    servings: 1
  };
}

function matchesAdapterFilters(recipe, options = {}) {
  const { maxDifficulty, maxCookMinutes, categories } = options;

  if (Number.isFinite(maxDifficulty) && (recipe.scoring?.difficulty ?? 1) > maxDifficulty) {
    return false;
  }

  if (Number.isFinite(maxCookMinutes) && (recipe.scoring?.cook_time_minutes ?? 20) > maxCookMinutes) {
    return false;
  }

  if (Array.isArray(categories) && categories.length > 0 && !categories.includes(recipe.category)) {
    return false;
  }

  return true;
}

export function adaptCatalogRecipe(recipe) {
  return adaptSingleRecipe(recipe);
}

export function adaptCatalogRecipes(catalog, options = {}) {
  const recipes = catalog?.recipes || [];

  return recipes.filter((recipe) => matchesAdapterFilters(recipe, options)).map(adaptSingleRecipe);
}
