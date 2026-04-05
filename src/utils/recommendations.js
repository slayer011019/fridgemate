import { getRemainingDays } from './date.js';
import { PANTRY_STATUS, pantryStaples } from '../data/pantryStaples.js';

const EXPIRING_SOON_DAYS = 3;
const MAX_OPTIONAL_BONUS = 20;
const MAX_URGENT_BONUS = 20;

export const RECIPE_STATUS = {
  READY: 'ready',
  NEEDS_CORE: 'needsCore'
};

export const ingredientAliases = {
  '\uB300\uD30C': ['\uD30C', '\uCABD\uD30C'],
  '\uAE40\uCE58': ['\uBC30\uCD94\uAE40\uCE58', '\uBB35\uC740\uC9C0'],
  '\uBC25': ['\uC300\uBC25', '\uACF5\uAE43\uBC25', '\uB0A8\uC740\uBC25'],
  '\uACC4\uB780': ['\uB2EC\uAC40', '\uACC4\uB780 1\uD310', '\uACC4\uB780 10\uAD6C'],
  '\uB3FC\uC9C0\uACE0\uAE30': ['\uC0BC\uACB9\uC0B4', '\uBAA9\uC0B4', '\uC55E\uB2E4\uB9AC\uC0B4', '\uB4B7\uB2E4\uB9AC\uC0B4', '\uC81C\uC721\uC6A9 \uB3FC\uC9C0\uACE0\uAE30'],
  '\uB2ED\uACE0\uAE30': ['\uB2ED\uB2E4\uB9AC\uC0B4', '\uB2ED\uC548\uC2EC', '\uB2ED\uBD09', '\uB2ED\uC815\uC721'],
  '\uCC38\uCE58\uCEA4': ['\uCC38\uCE58', '\uD1B5\uC870\uB9BC \uCC38\uCE58'],
  '\uC5B4\uBB35': ['\uC624\uB385'],
  '\uBC84\uC12F': ['\uC591\uC1A1\uC774\uBC84\uC12F', '\uB290\uD0C0\uB9AC\uBC84\uC12F', '\uC0C8\uC1A1\uC774\uBC84\uC12F', '\uD33D\uC774\uBC84\uC12F'],
  '\uD30C\uC2A4\uD0C0\uBA74': ['\uC2A4\uD30C\uAC8C\uD2F0\uBA74', '\uD30C\uC2A4\uD0C0'],
  '\uC6B0\uB3D9\uBA74': ['\uB0C9\uB3D9\uC6B0\uB3D9', '\uC0AC\uB204\uD0A4\uC6B0\uB3D9'],
  '\uC2DD\uBE75': ['\uD1A0\uC2A4\uD2B8 \uC2DD\uBE75', '\uBE75'],
  '\uB9C8\uC694\uB124\uC988': ['\uB9C8\uC694'],
  '\uB2E4\uC9C4 \uB9C8\uB298': ['\uB9C8\uB298', '\uAC04\uB9C8\uB298'],
  '\uC2DD\uC6A9\uC720': ['\uD3EC\uB3C4\uC528\uC720', '\uCE74\uB180\uB77C\uC720', '\uD574\uBC14\uB77C\uAE30\uC720'],
  '\uC62C\uB9AC\uBE0C\uC720': ['\uC5D1\uC2A4\uD2B8\uB77C\uBC84\uC9C4 \uC62C\uB9AC\uBE0C\uC720'],
  '\uCE74\uB808\uAC00\uB8E8': ['\uCE74\uB808', '\uACE0\uD615\uCE74\uB808'],
  '\uAD6D\uAC04\uC7A5': ['\uC870\uC120\uAC04\uC7A5'],
  '\uC694\uAC70\uD2B8': ['\uADF8\uB9AD\uC694\uAC70\uD2B8', '\uD50C\uB808\uC778\uC694\uAC70\uD2B8'],
  '\uB5A1': ['\uB5A1\uBCF6\uC774\uB5A1'],
  '\uBE0C\uB85C\uCF5C\uB9AC': ['\uBE0C\uB85C\uCEE4\uB9AC'],
  '\uC624\uC774': ['\uBC31\uC624\uC774', '\uC624\uC774 1\uAC1C'],
  '\uAC10\uC790': ['\uC54C\uAC10\uC790'],
  '\uC560\uD638\uBC15': ['\uD638\uBC15'],
  '\uD30C\uD504\uB9AC\uCE74': ['\uBE68\uAC04 \uD30C\uD504\uB9AC\uCE74', '\uB178\uB780 \uD30C\uD504\uB9AC\uCE74'],
  '\uC591\uBC30\uCD94': ['\uC591\uBC30\uCD94\uC78E'],
  '\uB2F9\uADFC': ['\uB2F9\uADFC 1\uAC1C'],
  '\uC591\uD30C': ['\uC591\uD30C 1\uAC1C'],
  '\uB450\uBD80': ['\uBD80\uCE68\uB450\uBD80', '\uCC0C\uAC1C\uB450\uBD80', '\uC5F0\uB450\uBD80'],
  '\uCE58\uD0A8\uC2A4\uD1A1': ['\uCE58\uD0A8 \uC2A4\uD1A1'],
  '\uD30C\uB9C8\uC0B0 \uCE58\uC988': ['\uD30C\uB974\uBBF8\uC9C0\uC544\uB178', '\uD30C\uB974\uBA54\uC0B0 \uCE58\uC988']
};

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()[\],.]/g, '');
}

const aliasToCanonical = Object.entries(ingredientAliases).reduce((map, [canonical, aliases]) => {
  map[normalizeKey(canonical)] = canonical;

  aliases.forEach((alias) => {
    map[normalizeKey(alias)] = canonical;
  });

  return map;
}, {});

export function normalizeIngredientName(name) {
  const key = normalizeKey(name);
  return aliasToCanonical[key] || String(name || '').trim();
}

function getItemName(item) {
  if (typeof item === 'string') {
    return item;
  }

  if (item && typeof item === 'object') {
    return item.name || item.normalizedName || '';
  }

  return item;
}

function uniqueNormalized(items = []) {
  const seen = new Set();
  const result = [];

  items.forEach((item) => {
    const normalized = normalizeIngredientName(getItemName(item));

    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    result.push(normalized);
  });

  return result;
}

function getOwnedPantryItems(pantryOwnership = {}) {
  return pantryStaples
    .filter((staple) => pantryOwnership[staple.id] === PANTRY_STATUS.OWNED)
    .map((staple) => staple.name);
}

function resolvePantryItems(options = {}) {
  if (Array.isArray(options)) {
    return options;
  }

  if (Object.prototype.hasOwnProperty.call(options, 'pantryItems')) {
    return Array.isArray(options.pantryItems) ? options.pantryItems : [];
  }

  if (options.pantryOwnership && typeof options.pantryOwnership === 'object') {
    return getOwnedPantryItems(options.pantryOwnership);
  }

  return [];
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

  uniqueNormalized(pantryItems).forEach((item) => {
    index.availableSet.add(item);
  });

  return index;
}

function getPreparedRecipe(recipe) {
  const coreIngredients = uniqueNormalized(recipe.coreIngredients || recipe.requiredIngredients || []);
  const optionalIngredients = uniqueNormalized(recipe.optionalIngredients || []);
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
  const candidates = uniqueNormalized([
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
