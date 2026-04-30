import { getRemainingDays } from './date.js';
import {
  normalizeIngredientName,
  resolvePantryItems,
  uniqueNormalizedIngredients
} from '../features/ingredients/ingredientDomain.js';
import { generateRecipeSearchLinks } from '../features/recipes/recipeSearchLinks.js';

export { ingredientAliases } from '../features/ingredients/ingredientDomain.js';
export { normalizeIngredientName } from '../features/ingredients/ingredientDomain.js';

const EXPIRING_SOON_DAYS = 3;

export const RECIPE_STATUS = {
  READY: 'ready',
  NEEDS_CORE: 'needsCore'
};

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function roundToTwo(value) {
  return Math.round(value * 100) / 100;
}

function getRecipeDisplayName(recipe = {}) {
  return String(recipe?.title || recipe?.name || '').trim();
}

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

function mapRecipeIngredient(item, ingredientType = 'main', section = 'main') {
  if (typeof item === 'string') {
    const normalizedName = normalizeIngredientName(item);

    if (!normalizedName) {
      return null;
    }

    return {
      rawName: item,
      normalizedName,
      ingredientType,
      section
    };
  }

  if (!item || typeof item !== 'object') {
    return null;
  }

  const rawName = String(item.rawName || item.name || item.normalizedName || '').trim();
  const normalizedName = normalizeIngredientName(item.normalizedName || rawName);

  if (!normalizedName) {
    return null;
  }

  return {
    ...item,
    rawName: rawName || normalizedName,
    normalizedName,
    ingredientType: item.ingredientType || ingredientType,
    section: item.section || section
  };
}

function uniqueByNormalizedName(items = []) {
  const seen = new Set();

  return items.filter((item) => {
    const normalizedName = item?.normalizedName;

    if (!normalizedName || seen.has(normalizedName)) {
      return false;
    }

    seen.add(normalizedName);
    return true;
  });
}

function buildIngredientGroups(recipe = {}) {
  if (Array.isArray(recipe.ingredients) && recipe.ingredients.length) {
    const normalizedIngredients = uniqueByNormalizedName(
      recipe.ingredients.map((item) => mapRecipeIngredient(item)).filter(Boolean)
    );

    return {
      mainIngredients: normalizedIngredients.filter((item) => item.ingredientType === 'main'),
      optionalIngredients: normalizedIngredients.filter(
        (item) => item.ingredientType === 'optional' || item.ingredientType === 'garnish'
      ),
      seasoningIngredients: normalizedIngredients.filter((item) => item.ingredientType === 'seasoning'),
      liquidIngredients: normalizedIngredients.filter((item) => item.ingredientType === 'liquid')
    };
  }

  const mainIngredients = uniqueByNormalizedName(
    uniqueNormalizedIngredients(recipe.coreIngredients || recipe.requiredIngredients || []).map((item) =>
      mapRecipeIngredient(item, 'main')
    )
  );
  const optionalIngredients = uniqueByNormalizedName(
    uniqueNormalizedIngredients(recipe.optionalIngredients || []).map((item) => mapRecipeIngredient(item, 'optional'))
  );
  const seasoningIngredients = uniqueByNormalizedName(
    uniqueNormalizedIngredients(recipe.requiredSeasonings || recipe.pantryIngredients || []).map((item) =>
      mapRecipeIngredient(item, 'seasoning', '양념장')
    )
  );

  return {
    mainIngredients,
    optionalIngredients,
    seasoningIngredients,
    liquidIngredients: []
  };
}

function prepareRecipe(recipe = {}) {
  const ingredientGroups = buildIngredientGroups(recipe);
  const displayName = getRecipeDisplayName(recipe);
  const requiredGroups = Array.isArray(recipe.requiredGroups) ? recipe.requiredGroups : [];
  const coreIngredients = ingredientGroups.mainIngredients.map((item) => item.normalizedName);
  const optionalIngredients = ingredientGroups.optionalIngredients.map((item) => item.normalizedName);
  const requiredSeasonings = ingredientGroups.seasoningIngredients.map((item) => item.normalizedName);

  return {
    ...recipe,
    id: recipe.id || recipe.sourceRecipeId || displayName,
    title: displayName,
    name: recipe.name || displayName,
    searchLinks: recipe.searchLinks || generateRecipeSearchLinks(displayName),
    coreIngredients,
    optionalIngredients,
    requiredIngredients: coreIngredients,
    requiredSeasonings,
    pantryIngredients: requiredSeasonings,
    ingredientGroups,
    requiredGroups
  };
}

function evaluateRequiredGroups(requiredGroups = [], ingredientIndex) {
  const satisfiedGroups = requiredGroups.filter(
    (group) =>
      Array.isArray(group.anyOf) &&
      group.anyOf.some((item) => ingredientIndex.availableSet.has(normalizeIngredientName(item)))
  );
  const missingGroups = requiredGroups
    .filter((group) => !satisfiedGroups.includes(group))
    .map((group) => group.label)
    .filter(Boolean);

  return {
    satisfiedGroups,
    missingGroups
  };
}

function computeMatchMetrics(preparedRecipe, ingredientIndex, recipeId = preparedRecipe.id) {
  const mainNames = preparedRecipe.ingredientGroups.mainIngredients.map((item) => item.normalizedName);
  const optionalNames = preparedRecipe.ingredientGroups.optionalIngredients.map((item) => item.normalizedName);
  const seasoningNames = preparedRecipe.ingredientGroups.seasoningIngredients.map((item) => item.normalizedName);

  const matchedMain = mainNames.filter((item) => ingredientIndex.availableSet.has(item));
  const missingMain = mainNames.filter((item) => !ingredientIndex.availableSet.has(item));
  const matchedOptional = optionalNames.filter((item) => ingredientIndex.availableSet.has(item));
  const matchedSeasonings = seasoningNames.filter((item) => ingredientIndex.availableSet.has(item));
  const missingSeasonings = seasoningNames.filter((item) => !ingredientIndex.availableSet.has(item));
  const { satisfiedGroups, missingGroups } = evaluateRequiredGroups(preparedRecipe.requiredGroups, ingredientIndex);
  const matchedIngredients = uniqueNormalizedIngredients([...matchedMain, ...matchedOptional]);
  const expiringMatchedIngredients = matchedIngredients.filter((item) => ingredientIndex.urgentSet.has(item)).slice(0, 3);

  const mainCoverage = mainNames.length ? matchedMain.length / mainNames.length : 0;
  const optionalCoverage = optionalNames.length ? matchedOptional.length / optionalNames.length : 0;
  const seasoningCoverage = seasoningNames.length ? matchedSeasonings.length / seasoningNames.length : 1;
  const groupCoverage = preparedRecipe.requiredGroups.length
    ? satisfiedGroups.length / preparedRecipe.requiredGroups.length
    : 1;
  const urgencyBonus = expiringMatchedIngredients.length
    ? Math.min(0.08, expiringMatchedIngredients.length * 0.04)
    : 0;
  const mainPenalty = mainNames.length ? (missingMain.length / mainNames.length) * 0.28 : 0;
  const groupPenalty = preparedRecipe.requiredGroups.length
    ? (missingGroups.length / preparedRecipe.requiredGroups.length) * 0.18
    : 0;
  const seasoningPenalty = seasoningNames.length ? (missingSeasonings.length / seasoningNames.length) * 0.04 : 0;
  const weightedBase = clamp(
    mainCoverage * 0.7 +
      optionalCoverage * 0.1 +
      groupCoverage * 0.1 +
      seasoningCoverage * 0.1 +
      urgencyBonus -
      mainPenalty -
      groupPenalty -
      seasoningPenalty
  );

  return {
    recipeId,
    score: roundToTwo(weightedBase),
    matchedIngredients,
    missingIngredients: missingMain,
    missingSeasonings,
    expiringMatchedIngredients,
    matchedMain,
    missingMain,
    matchedOptional,
    matchedSeasonings,
    satisfiedGroups,
    missingGroups
  };
}

function buildRecommendationReason({
  canMakeNow,
  missingIngredients,
  missingSeasonings,
  expiringMatchedIngredients,
  missingGroups
}) {
  if (canMakeNow) {
    return '핵심 재료가 모두 있어서 외부 레시피 검색으로 바로 조리법을 확인하면 좋아요.';
  }

  if (missingIngredients.length === 1) {
    return `${missingIngredients[0]}만 추가하면 바로 도전하기 좋아요.`;
  }

  if (expiringMatchedIngredients.length) {
    return `${expiringMatchedIngredients[0]}처럼 빨리 써야 하는 재료를 먼저 활용하기 좋은 메뉴예요.`;
  }

  if (missingSeasonings.length && missingIngredients.length <= 2) {
    return `핵심 재료는 대부분 맞고 ${missingSeasonings.join(', ')} 같은 양념만 조금 보완하면 돼요.`;
  }

  if (missingGroups.length) {
    return `${missingGroups.join(', ')} 조합을 채우면 매칭률이 더 좋아져요.`;
  }

  return '보유 재료와 겹치는 메뉴를 먼저 추천했어요.';
}

/**
 * @param {Array<string|{name?: string, rawName?: string, normalizedName?: string, ingredientType?: string, section?: string, consumed?: boolean, expiryDate?: string, expiresAt?: string}>} userIngredients
 * @param {Array<string|{rawName?: string, normalizedName?: string, ingredientType?: string, section?: string}>} recipeIngredients
 * @param {{ recipeId?: string, pantryItems?: string[] }} [options]
 * @returns {{
 *   recipeId: string | undefined,
 *   score: number,
 *   matchedIngredients: string[],
 *   missingIngredients: string[],
 *   missingSeasonings: string[],
 *   expiringMatchedIngredients: string[]
 * }}
 */
export function getRecipeMatchScore(userIngredients = [], recipeIngredients = [], options = {}) {
  const ingredientIndex = buildIngredientIndex(userIngredients, resolvePantryItems({ pantryItems: options.pantryItems }));
  const preparedRecipe = prepareRecipe({
    id: options.recipeId,
    ingredients: recipeIngredients
  });

  return computeMatchMetrics(preparedRecipe, ingredientIndex, options.recipeId);
}

function evaluateRecipe(recipe, ingredientIndex) {
  const preparedRecipe = prepareRecipe(recipe);
  const matchMetrics = computeMatchMetrics(preparedRecipe, ingredientIndex, preparedRecipe.id);
  const canMakeNow = matchMetrics.missingIngredients.length === 0 && matchMetrics.missingGroups.length === 0;
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        matchMetrics.score * 100 -
          matchMetrics.missingIngredients.length * 18 -
          matchMetrics.missingGroups.length * 12 +
          matchMetrics.matchedOptional.length * 4 +
          matchMetrics.expiringMatchedIngredients.length * 6
      )
    )
  );
  const reason = buildRecommendationReason({
    canMakeNow,
    missingIngredients: matchMetrics.missingIngredients,
    missingSeasonings: matchMetrics.missingSeasonings,
    expiringMatchedIngredients: matchMetrics.expiringMatchedIngredients,
    missingGroups: matchMetrics.missingGroups
  });

  return {
    ...preparedRecipe,
    score,
    scoreLabel: `${score}점`,
    matchRate: matchMetrics.score,
    matchRateLabel: `${Math.round(matchMetrics.score * 100)}%`,
    missingCore: matchMetrics.missingIngredients,
    missingGroups: matchMetrics.missingGroups,
    urgentMatches: matchMetrics.expiringMatchedIngredients,
    canMakeNow,
    matchedCore: matchMetrics.matchedMain,
    matchedOptional: matchMetrics.matchedOptional,
    matchedSeasonings: matchMetrics.matchedSeasonings,
    matchedIngredients: matchMetrics.matchedIngredients,
    missingIngredients: matchMetrics.missingIngredients,
    missingSeasonings: matchMetrics.missingSeasonings,
    matchedCount: matchMetrics.matchedMain.length,
    missingCount: matchMetrics.missingIngredients.length + matchMetrics.missingGroups.length,
    totalRequiredIngredients: preparedRecipe.coreIngredients.length,
    expiringMatchedIngredients: matchMetrics.expiringMatchedIngredients,
    useSoon: matchMetrics.expiringMatchedIngredients.length > 0,
    status: canMakeNow ? RECIPE_STATUS.READY : RECIPE_STATUS.NEEDS_CORE,
    reason,
    baseScore: roundToTwo(preparedRecipe.coreIngredients.length ? matchMetrics.matchedMain.length / preparedRecipe.coreIngredients.length : 0)
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

      if (left.missingIngredients.length !== right.missingIngredients.length) {
        return left.missingIngredients.length - right.missingIngredients.length;
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
  const recipe = recipes.find((item) => (item.id || item.sourceRecipeId || getRecipeDisplayName(item)) === recipeId);

  if (!recipe) {
    return null;
  }

  return evaluateRecipe(recipe, buildIngredientIndex(fridgeIngredients, resolvePantryItems({ pantryItems, pantryOwnership })));
}
