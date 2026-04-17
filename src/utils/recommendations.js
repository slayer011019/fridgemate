import { getRemainingDays } from './date.js';
import {
  normalizeIngredientName,
  resolvePantryItems,
  uniqueNormalizedIngredients
} from '../features/ingredients/ingredientDomain.js';
export { ingredientAliases } from '../features/ingredients/ingredientDomain.js';
export { normalizeIngredientName } from '../features/ingredients/ingredientDomain.js';

const EXPIRING_SOON_DAYS = 3;
const MAX_OPTIONAL_BONUS = 20;
const MAX_URGENT_BONUS = 20;

export const RECIPE_STATUS = {
  READY: 'ready',
  NEEDS_CORE: 'needsCore'
};

function buildIngredientIndex(ingredients = [], pantryItems = []) {
  const index = ingredients.reduce(
    (result, ingredient) => {
      if (ingredient?.consumed) {
        return result;
      }

      const normalizedName = normalizeIngredientName(ingredient?.name);

      if (!normalizedName) {
        return result;
      }

      result.availableSet.add(normalizedName);

      const expiresAt = ingredient?.expiresAt || ingredient?.expiryDate || null;
      const remainingDays = getRemainingDays(expiresAt);

      if (remainingDays !== null && remainingDays >= 0 && remainingDays <= EXPIRING_SOON_DAYS) {
        result.urgentSet.add(normalizedName);
      }

      return result;
    },
    {
      availableSet: new Set(),
      urgentSet: new Set()
    }
  );

  uniqueNormalizedIngredients(pantryItems).forEach((item) => {
    index.availableSet.add(item);
  });

  return index;
}

function getPreparedRecipe(recipe) {
  const coreIngredients = uniqueNormalizedIngredients(recipe.coreIngredients || recipe.requiredIngredients || []);
  const optionalIngredients = uniqueNormalizedIngredients(recipe.optionalIngredients || []);
  const requiredGroups = Array.isArray(recipe.requiredGroups) ? recipe.requiredGroups : [];

  return {
    ...recipe,
    coreIngredients,
    optionalIngredients,
    requiredGroups,
    requiredIngredients: coreIngredients,
    requiredSeasonings: recipe.requiredSeasonings || [],
    pantryIngredients: recipe.pantryIngredients || recipe.requiredSeasonings || []
  };
}

function getUrgentMatches(preparedRecipe, ingredientIndex) {
  const candidates = uniqueNormalizedIngredients([
    ...preparedRecipe.coreIngredients,
    ...preparedRecipe.optionalIngredients,
    ...preparedRecipe.pantryIngredients
  ]);

  return candidates.filter((item) => ingredientIndex.urgentSet.has(item)).slice(0, 2);
}

function evaluateRecipe(recipe, ingredientIndex) {
  const preparedRecipe = getPreparedRecipe(recipe);
  const matchedCore = preparedRecipe.coreIngredients.filter((item) => ingredientIndex.availableSet.has(item));
  const missingCore = preparedRecipe.coreIngredients.filter((item) => !ingredientIndex.availableSet.has(item));
  const matchedOptional = preparedRecipe.optionalIngredients.filter((item) => ingredientIndex.availableSet.has(item));

  const satisfiedGroups = preparedRecipe.requiredGroups.filter((group) =>
    Array.isArray(group.anyOf) && group.anyOf.some((item) => ingredientIndex.availableSet.has(normalizeIngredientName(item)))
  );
  const missingGroups = preparedRecipe.requiredGroups
    .filter((group) => !satisfiedGroups.includes(group))
    .map((group) => group.label);

  const urgentMatches = getUrgentMatches(preparedRecipe, ingredientIndex);
  const coreMatchRate = preparedRecipe.coreIngredients.length
    ? matchedCore.length / preparedRecipe.coreIngredients.length
    : 0;

  const coreScore = coreMatchRate * 50;
  const optionalScore = Math.min(MAX_OPTIONAL_BONUS, matchedOptional.length * 3);
  const groupScore = satisfiedGroups.length * 10;
  const urgentScore = Math.min(MAX_URGENT_BONUS, urgentMatches.length * 10);
  const missingCorePenalty = missingCore.length * 15;
  const rawScore = coreScore + optionalScore + groupScore + urgentScore - missingCorePenalty;
  const score = Math.max(0, Math.round(rawScore));
  const canMakeNow = score >= 50 && missingCore.length === 0;

  let reason = '';
  if (canMakeNow) {
    reason = '\uD575\uC2EC \uC7AC\uB8CC\uAC00 \uAC16\uCDB0\uC838 \uC788\uC5B4\uC11C \uBC14\uB85C \uB9CC\uB4E4\uAE30 \uC88B\uC544\uC694.';
  } else if (missingCore.length === 1) {
    reason = `${missingCore[0]}\uB9CC \uBCF4\uC644\uD558\uBA74 \uBC14\uB85C \uB3C4\uC804\uD558\uAE30 \uC88B\uC544\uC694.`;
  } else if (urgentMatches.length) {
    reason = `${urgentMatches[0]}\uCC98\uB7FC \uBE68\uB9AC \uC368\uC57C \uD558\uB294 \uC7AC\uB8CC\uB97C \uBA3C\uC800 \uD65C\uC6A9\uD558\uAE30 \uC88B\uC544\uC694.`;
  } else if (missingGroups.length) {
    reason = `${missingGroups.join(', ')} \uC870\uAC74\uC744 \uCC44\uC6B0\uBA74 \uC870\uD569\uC774 \uB354 \uC88B\uC544\uC838\uC694.`;
  } else {
    reason = '\uD575\uC2EC \uC7AC\uB8CC\uB97C \uC870\uAE08 \uB354 \uCC44\uC6B0\uBA74 \uCD94\uCC9C \uC810\uC218\uAC00 \uBE60\uB974\uAC8C \uC62C\uB77C\uAC00\uC694.';
  }

  return {
    ...preparedRecipe,
    score,
    scoreLabel: `${score}\uC810`,
    missingCore,
    missingGroups,
    urgentMatches,
    canMakeNow,
    matchedCore,
    matchedOptional,
    matchedIngredients: matchedCore,
    missingIngredients: missingCore,
    matchedCount: matchedCore.length,
    missingCount: missingCore.length + missingGroups.length,
    totalRequiredIngredients: preparedRecipe.coreIngredients.length,
    expiringMatchedIngredients: urgentMatches,
    useSoon: urgentMatches.length > 0,
    status: canMakeNow ? RECIPE_STATUS.READY : RECIPE_STATUS.NEEDS_CORE,
    reason,
    baseScore: Math.round(coreMatchRate * 100) / 100
  };
}

export function recommendRecipes({
  recipes = [],
  fridgeIngredients = [],
  pantryItems = [],
  pantryOwnership = {},
  limit = recipes.length
} = {}) {
  const ingredientIndex = buildIngredientIndex(fridgeIngredients, resolvePantryItems({ pantryItems, pantryOwnership }));

  return recipes
    .map((recipe) => evaluateRecipe(recipe, ingredientIndex))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (left.missingCore.length !== right.missingCore.length) {
        return left.missingCore.length - right.missingCore.length;
      }

      return left.title.localeCompare(right.title, 'ko');
    })
    .slice(0, limit);
}

export function buildRecipeRecommendations(recipes, ingredients, options = {}) {
  return recommendRecipes({
    recipes,
    fridgeIngredients: ingredients,
    pantryItems: resolvePantryItems(options),
    limit: recipes.length
  });
}

export function getTopRecommendations(recipes, ingredients, limit = 3, options = {}) {
  return buildRecipeRecommendations(recipes, ingredients, options)
    .filter((recipe) => recipe.score > 0)
    .slice(0, limit);
}

export function explainRecipeMatch(
  recipeId,
  { recipes = [], fridgeIngredients = [], pantryItems = [], pantryOwnership = {} } = {}
) {
  const recipe = recipes.find((item) => item.id === recipeId);

  if (!recipe) {
    return null;
  }

  return evaluateRecipe(recipe, buildIngredientIndex(fridgeIngredients, resolvePantryItems({ pantryItems, pantryOwnership })));
}
