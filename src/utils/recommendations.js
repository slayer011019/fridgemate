import { pantryStaples, PANTRY_STATUS, getPantryStapleByName } from '../data/pantryStaples.js';
import { getRemainingDays } from './date.js';

const EXPIRING_SOON_DAYS = 2;
const preparedRecipeCache = new Map();

export const RECIPE_STATUS = {
  COOKABLE: 'cookable',
  ALMOST: 'almostCookable',
  NOT_RECOMMENDED: 'notRecommended'
};

export const ingredientAliases = {
  대파: ['파', '쪽파'],
  김치: ['배추김치', '묵은지'],
  밥: ['쌀밥', '공깃밥', '남은밥'],
  계란: ['달걀', '계란 1판', '계란 10구'],
  돼지고기: ['삼겹살', '목살', '앞다리살', '뒷다리살', '제육용 돼지고기'],
  닭고기: ['닭다리살', '닭안심', '닭봉', '닭정육'],
  참치캔: ['참치', '통조림 참치'],
  어묵: ['오뎅'],
  버섯: ['양송이버섯', '느타리버섯', '새송이버섯', '팽이버섯'],
  파스타면: ['스파게티면', '파스타'],
  우동면: ['냉동우동', '사누키우동'],
  식빵: ['토스트 식빵', '빵'],
  마요네즈: ['마요'],
  '다진 마늘': ['마늘', '간마늘'],
  식용유: ['포도씨유', '카놀라유', '해바라기유'],
  올리브유: ['엑스트라버진 올리브유'],
  카레가루: ['카레', '고형카레'],
  국간장: ['조선간장'],
  요거트: ['그릭요거트', '플레인요거트'],
  떡: ['떡볶이떡'],
  브로콜리: ['브로컬리'],
  오이: ['백오이', '오이 1개'],
  감자: ['알감자'],
  애호박: ['호박'],
  파프리카: ['빨간 파프리카', '노란 파프리카'],
  양배추: ['양배추잎'],
  당근: ['당근 1개'],
  양파: ['양파 1개'],
  두부: ['부침두부', '찌개두부', '연두부'],
  치킨스톡: ['치킨 스톡'],
  '파마산 치즈': ['파르미지아노', '파르메산 치즈']
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

export function normalizeIngredientList(items = []) {
  return [...new Set(items.filter(Boolean).map(normalizeIngredientName))];
}

function hasItem(itemSet, name) {
  return itemSet.has(normalizeIngredientName(name));
}

function matchGroup(itemSet, group) {
  return group.anyOf.some((item) => hasItem(itemSet, item));
}

function prettyJoin(items = []) {
  if (!items.length) {
    return '';
  }

  if (items.length === 1) {
    return items[0];
  }

  return `${items.slice(0, -1).join(', ')} 그리고 ${items[items.length - 1]}`;
}

function parseCookingMinutes(cookingTime) {
  const match = String(cookingTime || '').match(/\d+/);
  return match ? Number(match[0]) : null;
}

function getDifficultyLabel(cookingTime, status) {
  const minutes = parseCookingMinutes(cookingTime);

  if (status === RECIPE_STATUS.COOKABLE && minutes !== null && minutes <= 15) {
    return '쉬움';
  }

  if (minutes !== null && minutes <= 25) {
    return '보통';
  }

  return '조금 손이 가요';
}

function getPreparedRecipe(recipe) {
  if (preparedRecipeCache.has(recipe.id)) {
    return preparedRecipeCache.get(recipe.id);
  }

  const preparedRecipe = {
    ...recipe,
    primaryIngredient: recipe.primaryIngredient || (recipe.coreIngredients || recipe.ingredients || [])[0] || recipe.title,
    requiredIngredients: recipe.requiredIngredients || recipe.coreIngredients || recipe.ingredients || [],
    requiredSeasonings: recipe.requiredSeasonings || [],
    optionalIngredients: recipe.optionalIngredients || [],
    requiredGroups: recipe.requiredGroups || []
  };

  preparedRecipe.normalizedRequiredIngredients = preparedRecipe.requiredIngredients.map(normalizeIngredientName);
  preparedRecipe.normalizedRequiredSeasonings = preparedRecipe.requiredSeasonings.map(normalizeIngredientName);
  preparedRecipe.normalizedOptionalIngredients = preparedRecipe.optionalIngredients.map(normalizeIngredientName);
  preparedRecipe.totalRequiredCount = preparedRecipe.requiredIngredients.length + preparedRecipe.requiredGroups.length;

  preparedRecipeCache.set(recipe.id, preparedRecipe);
  return preparedRecipe;
}

function buildOwnedIngredientIndex(ingredients) {
  return ingredients.reduce(
    (index, ingredient) => {
      if (ingredient.consumed) {
        return index;
      }

      const normalizedName = normalizeIngredientName(ingredient.name);

      if (!normalizedName) {
        return index;
      }

      index.fridgeSet.add(normalizedName);
      index.fridgeNames.push(normalizedName);

      const remainingDays = getRemainingDays(ingredient.expiryDate);
      if (remainingDays !== null && remainingDays >= 0 && remainingDays <= EXPIRING_SOON_DAYS) {
        index.expiringSoonSet.add(normalizedName);
      }

      return index;
    },
    {
      fridgeSet: new Set(),
      fridgeNames: [],
      expiringSoonSet: new Set()
    }
  );
}

function buildPantrySets(options = {}) {
  const pantryOwnedSet = new Set();
  const pantryMissingSet = new Set();
  const pantryUnknownSet = new Set();

  if (Array.isArray(options.pantryItems)) {
    normalizeIngredientList(options.pantryItems).forEach((item) => {
      pantryOwnedSet.add(item);
    });

    return {
      pantryOwnedSet,
      pantryMissingSet,
      pantryUnknownSet
    };
  }

  pantryStaples.forEach((staple) => {
    const status = options.pantryOwnership?.[staple.id] || PANTRY_STATUS.UNKNOWN;
    const canonicalName = normalizeIngredientName(staple.name);

    if (status === PANTRY_STATUS.OWNED) {
      pantryOwnedSet.add(canonicalName);
    } else if (status === PANTRY_STATUS.MISSING) {
      pantryMissingSet.add(canonicalName);
    } else {
      pantryUnknownSet.add(canonicalName);
    }
  });

  return {
    pantryOwnedSet,
    pantryMissingSet,
    pantryUnknownSet
  };
}

function evaluateRecipe(preparedRecipe, ingredientIndex, pantrySets) {
  const combinedSet = new Set([...ingredientIndex.fridgeSet, ...pantrySets.pantryOwnedSet]);
  const matchedRequired = [];
  const missingRequired = [];
  const expiringMatchedIngredients = [];

  preparedRecipe.requiredIngredients.forEach((ingredient, index) => {
    const normalizedIngredient = preparedRecipe.normalizedRequiredIngredients[index];

    if (ingredientIndex.fridgeSet.has(normalizedIngredient) || combinedSet.has(normalizedIngredient)) {
      matchedRequired.push(normalizeIngredientName(ingredient));

      if (ingredientIndex.expiringSoonSet.has(normalizedIngredient)) {
        expiringMatchedIngredients.push(normalizeIngredientName(ingredient));
      }

      return;
    }

    missingRequired.push(normalizeIngredientName(ingredient));
  });

  preparedRecipe.requiredGroups.forEach((group) => {
    if (matchGroup(ingredientIndex.fridgeSet, group) || matchGroup(combinedSet, group)) {
      matchedRequired.push(group.label);
      return;
    }

    missingRequired.push(group.label);
  });

  const matchedSeasonings = [];
  const missingSeasonings = [];
  const unknownSeasonings = [];

  preparedRecipe.requiredSeasonings.forEach((seasoning, index) => {
    const normalizedSeasoning = preparedRecipe.normalizedRequiredSeasonings[index];

    if (pantrySets.pantryOwnedSet.has(normalizedSeasoning) || combinedSet.has(normalizedSeasoning)) {
      matchedSeasonings.push(normalizeIngredientName(seasoning));
      return;
    }

    if (pantrySets.pantryMissingSet.has(normalizedSeasoning)) {
      missingSeasonings.push(normalizeIngredientName(seasoning));
      return;
    }

    unknownSeasonings.push(normalizeIngredientName(seasoning));
  });

  const matchedOptional = preparedRecipe.optionalIngredients.filter((ingredient, index) => {
    const normalizedIngredient = preparedRecipe.normalizedOptionalIngredients[index];
    return combinedSet.has(normalizedIngredient);
  });

  const totalRequiredCount = preparedRecipe.totalRequiredCount || 1;
  const totalSeasoningCount = preparedRecipe.requiredSeasonings.length;
  const optionalCount = preparedRecipe.optionalIngredients.length;
  const requiredRatio = matchedRequired.length / totalRequiredCount;
  const seasoningRatio = totalSeasoningCount === 0 ? 1 : matchedSeasonings.length / totalSeasoningCount;
  const optionalRatio = optionalCount === 0 ? 0 : matchedOptional.length / optionalCount;

  let status = RECIPE_STATUS.NOT_RECOMMENDED;

  if (missingRequired.length === 0 && missingSeasonings.length === 0) {
    status = RECIPE_STATUS.COOKABLE;
  } else if (missingRequired.length === 0 && missingSeasonings.length <= 2) {
    status = RECIPE_STATUS.ALMOST;
  } else if (missingRequired.length + missingSeasonings.length <= 2 && requiredRatio >= 0.67) {
    status = RECIPE_STATUS.ALMOST;
  }

  let score = 0;
  score += requiredRatio * 70;
  score += seasoningRatio * 20;
  score += optionalRatio * 10;
  score -= missingRequired.length * 18;
  score -= missingSeasonings.length * 10;
  score -= unknownSeasonings.length * 3;

  if (expiringMatchedIngredients.length) {
    score += Math.min(10, expiringMatchedIngredients.length * 4);
  }

  if (status === RECIPE_STATUS.COOKABLE) {
    score += 10;
  }

  if (status === RECIPE_STATUS.ALMOST) {
    score += 4;
  }

  if (status === RECIPE_STATUS.NOT_RECOMMENDED) {
    score -= 10;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let recommendationType = 'other';
  const totalMissingCount = missingRequired.length + missingSeasonings.length;

  if (status === RECIPE_STATUS.COOKABLE) {
    recommendationType = 'ready';
  } else if (status === RECIPE_STATUS.ALMOST && totalMissingCount === 1) {
    recommendationType = 'buyOne';
  }

  let reason = '';

  if (status === RECIPE_STATUS.COOKABLE) {
    reason = '핵심 재료와 필요한 기본 양념이 갖춰져 있어서 지금 바로 만들 수 있어요.';
  } else if (missingRequired.length === 0 && missingSeasonings.length > 0) {
    reason = `${prettyJoin(missingSeasonings)} 정도만 보완하면 만들기 쉬워요.`;
  } else if (status === RECIPE_STATUS.ALMOST) {
    reason = `${prettyJoin([...missingRequired, ...missingSeasonings])} 정도만 더 있으면 가능해요.`;
  } else {
    reason = `${prettyJoin([...missingRequired, ...missingSeasonings])}가 부족해서 지금은 우선순위가 낮아요.`;
  }

  if (expiringMatchedIngredients.length) {
    reason = `${expiringMatchedIngredients[0]}처럼 유통기한이 가까운 재료를 활용할 수 있어요.`;
  }

  if (!missingRequired.length && !missingSeasonings.length && unknownSeasonings.length) {
    reason = '핵심 재료는 모두 있어요. 기본 조미료가 갖춰져 있다면 바로 만들 수 있어요.';
  }

  return {
    ...preparedRecipe,
    ingredients: preparedRecipe.requiredIngredients,
    coreIngredients: preparedRecipe.requiredIngredients,
    pantryIngredients: preparedRecipe.requiredSeasonings,
    status,
    score,
    diversityAdjustedScore: score,
    matchedRequired,
    missingRequired,
    matchedSeasonings,
    missingSeasonings,
    matchedOptional,
    matchedIngredients: matchedRequired,
    matchedCoreIngredients: matchedRequired,
    missingIngredients: missingRequired,
    coreMissingIngredients: missingRequired,
    pantryOwnedIngredients: matchedSeasonings,
    pantryMissingIngredients: missingSeasonings,
    pantryUnknownIngredients: unknownSeasonings,
    expiringMatchedIngredients,
    matchedCount: matchedRequired.length,
    missingCount: missingRequired.length,
    totalRequiredIngredients: totalRequiredCount,
    pantryOwnedCount: matchedSeasonings.length,
    pantryMissingCount: missingSeasonings.length,
    pantryUnknownCount: unknownSeasonings.length,
    matchedOptionalCount: matchedOptional.length,
    pantryReady: missingSeasonings.length === 0 && unknownSeasonings.length === 0,
    canMakeNow: status === RECIPE_STATUS.COOKABLE,
    useSoon: expiringMatchedIngredients.length > 0,
    expiringMatchCount: expiringMatchedIngredients.length,
    recommendationType,
    baseScore: Math.round(requiredRatio * 100) / 100,
    optionalBonus: Math.round(optionalRatio * 10) / 100,
    pantryOwnedBonus: Math.round(seasoningRatio * 20) / 100,
    pantryMissingPenalty: Math.round(missingSeasonings.length * 10) / 100,
    scoreLabel: `${score}점`,
    difficulty: preparedRecipe.difficulty || getDifficultyLabel(preparedRecipe.cookingTime, status),
    reason
  };
}

function applyDiversity(results) {
  const categoryCount = new Map();
  const primaryCount = new Map();
  const statusOrder = {
    [RECIPE_STATUS.COOKABLE]: 3,
    [RECIPE_STATUS.ALMOST]: 2,
    [RECIPE_STATUS.NOT_RECOMMENDED]: 1
  };

  return results
    .map((result) => {
      const categorySeen = categoryCount.get(result.category) || 0;
      const primarySeen = primaryCount.get(result.primaryIngredient) || 0;

      let diversityPenalty = 0;
      if (categorySeen >= 2) {
        diversityPenalty += 6;
      }
      if (primarySeen >= 1) {
        diversityPenalty += 8;
      }

      const adjusted = {
        ...result,
        diversityAdjustedScore: Math.max(0, result.score - diversityPenalty)
      };

      categoryCount.set(result.category, categorySeen + 1);
      primaryCount.set(result.primaryIngredient, primarySeen + 1);

      return adjusted;
    })
    .sort((left, right) => {
      if (statusOrder[right.status] !== statusOrder[left.status]) {
        return statusOrder[right.status] - statusOrder[left.status];
      }

      if (right.diversityAdjustedScore !== left.diversityAdjustedScore) {
        return right.diversityAdjustedScore - left.diversityAdjustedScore;
      }

      return right.score - left.score;
    });
}

export function recommendRecipes({ recipes = [], fridgeIngredients = [], pantryItems = [], pantryOwnership = {}, limit = 8, includeNotRecommended = false } = {}) {
  const ingredientIndex = buildOwnedIngredientIndex(fridgeIngredients);
  const pantrySets = Array.isArray(pantryItems)
    ? buildPantrySets({ pantryItems })
    : buildPantrySets({ pantryOwnership });

  const evaluated = recipes.map((recipe) => evaluateRecipe(getPreparedRecipe(recipe), ingredientIndex, pantrySets));
  const filtered = includeNotRecommended ? evaluated : evaluated.filter((item) => item.status !== RECIPE_STATUS.NOT_RECOMMENDED);

  return applyDiversity(filtered.sort((left, right) => right.score - left.score)).slice(0, limit);
}

export function getRecommendationSummary(results = []) {
  return results.reduce(
    (summary, item) => {
      if (item.status === RECIPE_STATUS.COOKABLE) {
        summary.cookable += 1;
      }
      if (item.status === RECIPE_STATUS.ALMOST) {
        summary.almostCookable += 1;
      }
      if (item.status === RECIPE_STATUS.NOT_RECOMMENDED) {
        summary.notRecommended += 1;
      }

      return summary;
    },
    {
      cookable: 0,
      almostCookable: 0,
      notRecommended: 0
    }
  );
}

export function explainRecipeMatch(recipeId, { recipes = [], fridgeIngredients = [], pantryItems = [], pantryOwnership = {} } = {}) {
  const recipe = recipes.find((item) => item.id === recipeId);

  if (!recipe) {
    return null;
  }

  const ingredientIndex = buildOwnedIngredientIndex(fridgeIngredients);
  const pantrySets = Array.isArray(pantryItems)
    ? buildPantrySets({ pantryItems })
    : buildPantrySets({ pantryOwnership });

  return evaluateRecipe(getPreparedRecipe(recipe), ingredientIndex, pantrySets);
}

export function buildRecipeRecommendations(recipes, ingredients, options = {}) {
  const recommendations = recommendRecipes({
    recipes,
    fridgeIngredients: ingredients,
    pantryOwnership: options.pantryOwnership,
    limit: recipes.length,
    includeNotRecommended: true
  });

  return {
    all: recommendations,
    ready: recommendations.filter((recipe) => recipe.recommendationType === 'ready'),
    buyOne: recommendations.filter((recipe) => recipe.recommendationType === 'buyOne'),
    other: recommendations.filter((recipe) => recipe.recommendationType === 'other' && recipe.status !== RECIPE_STATUS.NOT_RECOMMENDED)
  };
}

export function getTopRecommendations(recipes, ingredients, limit = 3, options = {}) {
  return buildRecipeRecommendations(recipes, ingredients, options).all
    .filter((recipe) => recipe.status !== RECIPE_STATUS.NOT_RECOMMENDED)
    .slice(0, limit);
}
