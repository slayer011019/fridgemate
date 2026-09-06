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
  BROWSE: 'browse',
  READY: 'ready',
  NEEDS_SEASONINGS: 'needsSeasonings',
  INSUFFICIENT_DATA: 'insufficientData',
  NEEDS_CORE: 'needsCore'
};

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function roundToTwo(value) {
  return Math.round(value * 100) / 100;
}

function normalizeHomePriority(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;
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

      const normalizedName = normalizeIngredientName(
        typeof ingredient === 'string' ? ingredient : ingredient?.name || ingredient?.normalizedName || ingredient?.rawName
      );

      if (!normalizedName) {
        return result;
      }

      result.availableSet.add(normalizedName);
      result.fridgeSet.add(normalizedName);

      const expiresAt = ingredient?.expiresAt || ingredient?.expiryDate || null;
      const remainingDays = getRemainingDays(expiresAt);

      if (remainingDays !== null && remainingDays >= 0 && remainingDays <= EXPIRING_SOON_DAYS) {
        result.urgentSet.add(normalizedName);
      }

      return result;
    },
    {
      availableSet: new Set(),
      fridgeSet: new Set(),
      urgentSet: new Set()
    }
  );

  uniqueNormalizedIngredients(pantryItems).forEach((item) => {
    index.availableSet.add(item);
  });

  index.inputState = index.fridgeSet.size ? 'ingredients' : index.availableSet.size ? 'pantryOnly' : 'empty';

  return index;
}

export function getRecommendationInputState(fridgeIngredients = [], options = {}) {
  return buildIngredientIndex(fridgeIngredients, resolvePantryItems(options)).inputState;
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
      [
        ...recipe.ingredients.map((item) => mapRecipeIngredient(item)),
        ...(recipe.requiredSeasonings || recipe.pantryIngredients || []).map((item) => mapRecipeIngredient(item, 'seasoning', '양념장')),
        ...(recipe.optionalIngredients || []).map((item) => mapRecipeIngredient(item, 'optional'))
      ].filter(Boolean)
    );

    return {
      mainIngredients: normalizedIngredients.filter((item) => item.ingredientType === 'main'),
      optionalIngredients: normalizedIngredients.filter(
        (item) => item.ingredientType === 'optional' || item.ingredientType === 'garnish'
      ),
      seasoningIngredients: normalizedIngredients.filter((item) => item.ingredientType === 'seasoning'),
      liquidIngredients: normalizedIngredients.filter((item) => item.ingredientType === 'liquid'),
      unknownIngredients: normalizedIngredients.filter((item) => item.ingredientType === 'unknown')
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
    liquidIngredients: [],
    unknownIngredients: []
  };
}

function prepareRecipe(recipe = {}) {
  const ingredientGroups = buildIngredientGroups(recipe);
  const displayName = getRecipeDisplayName(recipe);
  const requiredGroups = Array.isArray(recipe.requiredGroups)
    ? recipe.requiredGroups.filter((group) => group && typeof group === 'object')
    : [];
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
    .map((group) => group.label || uniqueNormalizedIngredients(group.anyOf || []).join(' 또는 ') || '필수 재료 조합');

  return {
    satisfiedGroups,
    missingGroups
  };
}

function applyPreferenceAdjustment(metrics, preparedRecipe, preferences = {}) {
  const recipeIngredients = uniqueNormalizedIngredients([
    ...preparedRecipe.coreIngredients,
    ...preparedRecipe.optionalIngredients,
    ...preparedRecipe.requiredSeasonings
  ]);
  const preferredSet = new Set(uniqueNormalizedIngredients(preferences.preferredIngredients || []));
  const dislikedSet = new Set(uniqueNormalizedIngredients(preferences.dislikedIngredients || []));
  const preferredMatches = recipeIngredients.filter((item) => preferredSet.has(item));
  const dislikedMatches = recipeIngredients.filter((item) => dislikedSet.has(item));
  const preferenceBonus = Math.min(0.08, preferredMatches.length * 0.04);
  const dislikePenalty = Math.min(0.35, dislikedMatches.length * 0.18);

  return {
    ...metrics,
    score: roundToTwo(clamp(metrics.score + preferenceBonus - dislikePenalty)),
    preferredMatches,
    dislikedMatches,
    preferenceBonus,
    dislikePenalty
  };
}

function computeMatchMetrics(preparedRecipe, ingredientIndex, recipeId = preparedRecipe.id, preferences = {}) {
  const mainNames = preparedRecipe.ingredientGroups.mainIngredients.map((item) => item.normalizedName);
  const optionalNames = preparedRecipe.ingredientGroups.optionalIngredients.map((item) => item.normalizedName);
  const seasoningNames = preparedRecipe.ingredientGroups.seasoningIngredients.map((item) => item.normalizedName);
  const unknownNames = preparedRecipe.ingredientGroups.unknownIngredients.map((item) => item.normalizedName);

  const matchedMain = mainNames.filter((item) => ingredientIndex.availableSet.has(item));
  const missingMain = mainNames.filter((item) => !ingredientIndex.availableSet.has(item));
  const matchedOptional = optionalNames.filter((item) => ingredientIndex.availableSet.has(item));
  const matchedSeasonings = seasoningNames.filter((item) => ingredientIndex.availableSet.has(item));
  const missingSeasonings = seasoningNames.filter((item) => !ingredientIndex.availableSet.has(item));
  const matchedUnknown = unknownNames.filter((item) => ingredientIndex.availableSet.has(item));
  const missingUnknown = unknownNames.filter((item) => !ingredientIndex.availableSet.has(item));
  const { satisfiedGroups, missingGroups } = evaluateRequiredGroups(preparedRecipe.requiredGroups, ingredientIndex);
  const matchedIngredients = uniqueNormalizedIngredients([...matchedMain, ...matchedUnknown, ...matchedOptional]);
  const expiringMatchedIngredients = matchedIngredients.filter((item) => ingredientIndex.urgentSet.has(item)).slice(0, 3);

  const mainCoverage = mainNames.length ? matchedMain.length / mainNames.length : 0;
  const optionalCoverage = optionalNames.length ? matchedOptional.length / optionalNames.length : 0;
  const seasoningCoverage = seasoningNames.length ? matchedSeasonings.length / seasoningNames.length : 1;
  const unknownCoverage = unknownNames.length ? matchedUnknown.length / unknownNames.length : 1;
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
  const unknownPenalty = unknownNames.length ? (missingUnknown.length / unknownNames.length) * 0.08 : 0;
  const weightedComponents = [
    mainNames.length ? { score: mainCoverage, weight: 0.7 } : null,
    unknownNames.length ? { score: unknownCoverage, weight: 0.15 } : null,
    optionalNames.length ? { score: optionalCoverage, weight: 0.05 } : null,
    preparedRecipe.requiredGroups.length ? { score: groupCoverage, weight: 0.05 } : null,
    seasoningNames.length ? { score: seasoningCoverage, weight: 0.05 } : null
  ].filter(Boolean);
  const totalComponentWeight = weightedComponents.reduce((total, component) => total + component.weight, 0);
  const normalizedCoverage = totalComponentWeight
    ? weightedComponents.reduce((total, component) => total + component.score * component.weight, 0) /
      totalComponentWeight
    : 0;
  const weightedBase = clamp(
    normalizedCoverage + urgencyBonus - mainPenalty - groupPenalty - seasoningPenalty - unknownPenalty
  );

  return applyPreferenceAdjustment({
    recipeId,
    score: roundToTwo(weightedBase),
    matchedIngredients,
    missingIngredients: missingMain,
    missingSeasonings,
    matchedUnknown,
    missingUnknown,
    expiringMatchedIngredients,
    matchedMain,
    missingMain,
    matchedOptional,
    matchedSeasonings,
    satisfiedGroups,
    missingGroups
  }, preparedRecipe, preferences);
}

function buildRecommendationReason({
  inputState,
  hasKnownRequirements,
  canMakeNow,
  canMakeWithOneMore,
  needsSeasonings,
  missingIngredients,
  missingSeasonings,
  missingUnknown,
  expiringMatchedIngredients,
  missingGroups,
  preferredMatches
}) {
  if (inputState === 'empty') {
    return '메뉴를 둘러보고 필요한 재료와 조리법을 확인해 보세요.';
  }

  const pantryPrefix = inputState === 'pantryOnly' ? '팬트리 보유 정보만 반영했어요. ' : '';
  const preferencePrefix = preferredMatches?.length ? `${preferredMatches[0]} 선호를 반영한 메뉴예요. ` : '';
  const prefix = `${pantryPrefix}${preferencePrefix}`;

  if (!hasKnownRequirements) {
    return `${prefix}핵심 재료 정보가 없어 조리 가능 여부를 판단하기 어려워요. 조리법의 재료를 확인해 주세요.`;
  }

  if (canMakeNow) {
    return `${prefix}필수 재료와 양념의 종류를 갖췄어요. 조리법에서 필요한 분량과 재료 상태를 확인해 주세요.`;
  }

  if (canMakeWithOneMore) {
    const missingRequirement = missingIngredients[0] || missingGroups[0];
    return `${prefix}${missingRequirement}만 더 준비하면 필수 재료 종류를 갖출 수 있어요. 분량은 조리법에서 확인해 주세요.`;
  }

  if (needsSeasonings) {
    return `${prefix}핵심 재료와 필수 조합은 갖췄어요. ${missingSeasonings.join(', ')} 양념을 추가로 준비해 주세요.`;
  }

  const missingDetails = [
    missingIngredients.length ? `핵심 재료: ${missingIngredients.join(', ')}` : '',
    missingGroups.length ? `필수 조합: ${missingGroups.join(', ')}` : '',
    missingSeasonings.length ? `양념: ${missingSeasonings.join(', ')}` : '',
    missingUnknown.length ? `분류 확인이 필요한 재료: ${missingUnknown.join(', ')}` : ''
  ].filter(Boolean).join(' / ');
  const urgency = expiringMatchedIngredients.length
    ? `${expiringMatchedIngredients[0]}을 먼저 활용할 수 있는 메뉴예요. `
    : '';

  return `${prefix}${urgency}추가로 확인할 항목은 ${missingDetails}예요.`;
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
  const ingredientIndex = buildIngredientIndex(userIngredients, resolvePantryItems(options));
  const preparedRecipe = prepareRecipe({
    id: options.recipeId,
    ingredients: recipeIngredients
  });

  return computeMatchMetrics(preparedRecipe, ingredientIndex, options.recipeId, options.preferences);
}

function evaluateRecipe(recipe, ingredientIndex, preferences = {}) {
  const preparedRecipe = prepareRecipe(recipe);
  const matchMetrics = computeMatchMetrics(preparedRecipe, ingredientIndex, preparedRecipe.id, preferences);
  const { inputState } = ingredientIndex;
  const isPersonalized = inputState !== 'empty';
  const hasKnownRequirements = preparedRecipe.coreIngredients.length + preparedRecipe.requiredGroups.length > 0;
  const hasCoreIngredients = isPersonalized && hasKnownRequirements &&
    matchMetrics.missingIngredients.length === 0 && matchMetrics.missingGroups.length === 0;
  const needsSeasonings = hasCoreIngredients && matchMetrics.missingSeasonings.length > 0 &&
    matchMetrics.missingUnknown.length === 0;
  const canMakeNow = hasCoreIngredients && matchMetrics.missingSeasonings.length === 0 &&
    matchMetrics.missingUnknown.length === 0;
  const canMakeWithOneMore = isPersonalized &&
    matchMetrics.matchedMain.length + matchMetrics.satisfiedGroups.length > 0 &&
    matchMetrics.missingIngredients.length + matchMetrics.missingGroups.length === 1 &&
    matchMetrics.missingSeasonings.every((item) => matchMetrics.missingIngredients.includes(item)) &&
    matchMetrics.missingUnknown.length === 0;
  const homePriority = normalizeHomePriority(preparedRecipe.homePriority);
  const ingredientRankingScore =
    matchMetrics.score * 100 -
    matchMetrics.missingIngredients.length * 18 -
    matchMetrics.missingGroups.length * 12 +
    matchMetrics.matchedOptional.length * 4 +
    matchMetrics.expiringMatchedIngredients.length * 6;
  const homePriorityBonus = homePriority * 0.2;
  const rankingScore = roundToTwo(ingredientRankingScore + homePriorityBonus);
  const score = Math.max(
    0,
    Math.min(100, Math.round(rankingScore))
  );
  const reason = buildRecommendationReason({
    inputState,
    hasKnownRequirements,
    canMakeNow,
    canMakeWithOneMore,
    needsSeasonings,
    missingIngredients: matchMetrics.missingIngredients,
    missingSeasonings: matchMetrics.missingSeasonings,
    missingUnknown: matchMetrics.missingUnknown,
    expiringMatchedIngredients: matchMetrics.expiringMatchedIngredients,
    missingGroups: matchMetrics.missingGroups,
    preferredMatches: matchMetrics.preferredMatches
  });

  return {
    ...preparedRecipe,
    inputState,
    isPersonalized,
    hasKnownRequirements,
    hasCoreIngredients,
    canMakeWithOneMore,
    needsSeasonings,
    homePriority,
    homePriorityBonus: roundToTwo(homePriorityBonus),
    rankingScore,
    score,
    scoreLabel: isPersonalized && hasKnownRequirements ? `${score}점` : '',
    matchRate: matchMetrics.score,
    matchRateLabel: isPersonalized && hasKnownRequirements ? `${Math.round(matchMetrics.score * 100)}%` : '',
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
    missingUnknownIngredients: matchMetrics.missingUnknown,
    matchedCount: matchMetrics.matchedMain.length,
    matchedCountLabel: isPersonalized && preparedRecipe.coreIngredients.length
      ? `${matchMetrics.matchedMain.length}/${preparedRecipe.coreIngredients.length}개 일치`
      : '',
    matchedRequiredGroupCount: matchMetrics.satisfiedGroups.length,
    missingCount: matchMetrics.missingIngredients.length + matchMetrics.missingGroups.length,
    totalRequiredIngredients: preparedRecipe.coreIngredients.length,
    expiringMatchedIngredients: matchMetrics.expiringMatchedIngredients,
    useSoon: matchMetrics.expiringMatchedIngredients.length > 0,
    status: !isPersonalized ? RECIPE_STATUS.BROWSE
      : !hasKnownRequirements ? RECIPE_STATUS.INSUFFICIENT_DATA
      : canMakeNow ? RECIPE_STATUS.READY
      : needsSeasonings ? RECIPE_STATUS.NEEDS_SEASONINGS
      : RECIPE_STATUS.NEEDS_CORE,
    reason,
    preferredMatches: matchMetrics.preferredMatches,
    dislikedMatches: matchMetrics.dislikedMatches,
    baseScore: roundToTwo(preparedRecipe.coreIngredients.length ? matchMetrics.matchedMain.length / preparedRecipe.coreIngredients.length : 0)
  };
}

function isRecipeCandidate(recipe, ingredientIndex) {
  if (!ingredientIndex.availableSet.size) return true;
  const preparedRecipe = prepareRecipe(recipe);
  const mainNames = preparedRecipe.ingredientGroups.mainIngredients.map((item) => item.normalizedName);
  if (!mainNames.length) return true;
  const matchedMainCount = mainNames.filter((item) => ingredientIndex.availableSet.has(item)).length;
  const missingRatio = (mainNames.length - matchedMainCount) / mainNames.length;

  // A household-priority bonus must not rescue a recipe that is unrelated to
  // the available ingredients or still lacks most of a large core set.
  return matchedMainCount > 0 && !(mainNames.length >= 3 && missingRatio > 2 / 3);
}

export function recommendRecipes(options = {}) {
  const {
    recipes = [],
    fridgeIngredients = [],
    preferences = {},
    limit = recipes.length
  } = options;
  const ingredientIndex = buildIngredientIndex(fridgeIngredients, resolvePantryItems(options));

  return recipes
    .filter((recipe) => isRecipeCandidate(recipe, ingredientIndex))
    .map((recipe) => evaluateRecipe(recipe, ingredientIndex, preferences))
    .sort((left, right) => {
      if (right.rankingScore !== left.rankingScore) {
        return right.rankingScore - left.rankingScore;
      }

      if (right.homePriority !== left.homePriority) {
        return right.homePriority - left.homePriority;
      }

      if (right.urgentMatches.length !== left.urgentMatches.length) {
        return right.urgentMatches.length - left.urgentMatches.length;
      }

      if (left.missingIngredients.length !== right.missingIngredients.length) {
        return left.missingIngredients.length - right.missingIngredients.length;
      }

      return 0;
    })
    .slice(0, limit);
}

export function buildRecipeRecommendations(recipes, ingredients, options = {}) {
  return recommendRecipes({
    recipes,
    fridgeIngredients: ingredients,
    pantryItems: resolvePantryItems(options),
    preferences: options.preferences,
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
  options = {}
) {
  const { recipes = [], fridgeIngredients = [] } = options;
  const recipe = recipes.find((item) => (item.id || item.sourceRecipeId || getRecipeDisplayName(item)) === recipeId);

  if (!recipe) {
    return null;
  }

  return evaluateRecipe(recipe, buildIngredientIndex(fridgeIngredients, resolvePantryItems(options)), options.preferences);
}
