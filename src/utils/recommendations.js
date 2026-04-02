import { getRemainingDays } from './date.js';

const EXPIRING_SOON_DAYS = 3;
const MAX_OPTIONAL_BONUS = 20;
const MAX_URGENT_BONUS = 20;

export const RECIPE_STATUS = {
  READY: 'ready',
  NEEDS_CORE: 'needsCore'
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

function uniqueNormalized(items = []) {
  const seen = new Set();
  const result = [];

  items.forEach((item) => {
    const normalized = normalizeIngredientName(item);

    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    result.push(normalized);
  });

  return result;
}

function buildIngredientIndex(ingredients = []) {
  return ingredients.reduce(
    (index, ingredient) => {
      if (ingredient?.consumed) {
        return index;
      }

      const normalizedName = normalizeIngredientName(ingredient?.name);

      if (!normalizedName) {
        return index;
      }

      index.availableSet.add(normalizedName);

      const expiresAt = ingredient?.expiresAt || ingredient?.expiryDate || null;
      const remainingDays = getRemainingDays(expiresAt);

      if (remainingDays !== null && remainingDays >= 0 && remainingDays <= EXPIRING_SOON_DAYS) {
        index.urgentSet.add(normalizedName);
      }

      return index;
    },
    {
      availableSet: new Set(),
      urgentSet: new Set()
    }
  );
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
    reason = '핵심 재료가 갖춰져 있어서 바로 만들기 좋아요.';
  } else if (missingCore.length === 1) {
    reason = `${missingCore[0]}만 보완하면 바로 도전하기 좋아요.`;
  } else if (urgentMatches.length) {
    reason = `${urgentMatches[0]}처럼 빨리 써야 하는 재료를 먼저 활용하기 좋아요.`;
  } else if (missingGroups.length) {
    reason = `${missingGroups.join(', ')} 조건을 채우면 조합이 더 좋아져요.`;
  } else {
    reason = '핵심 재료를 조금 더 채우면 추천 점수가 빠르게 올라가요.';
  }

  return {
    ...preparedRecipe,
    score,
    scoreLabel: `${score}점`,
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

export function recommendRecipes({ recipes = [], fridgeIngredients = [], limit = recipes.length } = {}) {
  const ingredientIndex = buildIngredientIndex(fridgeIngredients);

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

export function buildRecipeRecommendations(recipes, ingredients) {
  return recommendRecipes({
    recipes,
    fridgeIngredients: ingredients,
    limit: recipes.length
  });
}

export function getTopRecommendations(recipes, ingredients, limit = 3) {
  return buildRecipeRecommendations(recipes, ingredients)
    .filter((recipe) => recipe.score > 0)
    .slice(0, limit);
}

export function explainRecipeMatch(recipeId, { recipes = [], fridgeIngredients = [] } = {}) {
  const recipe = recipes.find((item) => item.id === recipeId);

  if (!recipe) {
    return null;
  }

  return evaluateRecipe(recipe, buildIngredientIndex(fridgeIngredients));
}
