import { getRemainingDays } from './date.js';

const EXPIRING_SOON_DAYS = 2;

function normalizeIngredientName(name) {
  return String(name || '').trim().toLowerCase();
}

function buildOwnedIngredientMap(ingredients) {
  return ingredients
    .filter((ingredient) => !ingredient.consumed)
    .reduce((map, ingredient) => {
      const key = normalizeIngredientName(ingredient.name);

      if (!key) {
        return map;
      }

      const remainingDays = getRemainingDays(ingredient.expiryDate);
      const nextItem = {
        ...ingredient,
        remainingDays,
        useSoon: remainingDays !== null && remainingDays >= 0 && remainingDays <= EXPIRING_SOON_DAYS
      };

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key).push(nextItem);
      return map;
    }, new Map());
}

function roundScore(score) {
  return Math.round(score * 100) / 100;
}

function sortRecommendations(left, right) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  if (right.expiringMatchCount !== left.expiringMatchCount) {
    return right.expiringMatchCount - left.expiringMatchCount;
  }

  return left.missingCount - right.missingCount;
}

export function buildRecipeRecommendations(recipes, ingredients) {
  const ownedIngredientMap = buildOwnedIngredientMap(ingredients);

  const recommendations = recipes
    .map((recipe) => {
      const matchedIngredients = [];
      const missingIngredients = [];
      const expiringMatchedIngredients = [];

      recipe.ingredients.forEach((ingredientName) => {
        const normalizedName = normalizeIngredientName(ingredientName);
        const ownedMatches = ownedIngredientMap.get(normalizedName);

        if (ownedMatches?.length) {
          matchedIngredients.push(ingredientName);

          if (ownedMatches.some((ownedIngredient) => ownedIngredient.useSoon)) {
            expiringMatchedIngredients.push(ingredientName);
          }
        } else {
          missingIngredients.push(ingredientName);
        }
      });

      const totalRequiredIngredients = recipe.ingredients.length || 1;
      const matchedCount = matchedIngredients.length;
      const missingCount = missingIngredients.length;
      const baseScore = matchedCount / totalRequiredIngredients;
      const expiryBonus = expiringMatchedIngredients.length ? Math.min(0.2, expiringMatchedIngredients.length * 0.05) : 0;
      const readyBonus = missingCount === 0 ? 0.2 : 0;
      const oneMissingBonus = missingCount === 1 ? 0.12 : 0;
      const score = roundScore(baseScore + expiryBonus + readyBonus + oneMissingBonus);

      let recommendationType = 'other';
      if (missingCount === 0) {
        recommendationType = 'ready';
      } else if (missingCount === 1) {
        recommendationType = 'buyOne';
      }

      return {
        ...recipe,
        matchedIngredients,
        missingIngredients,
        expiringMatchedIngredients,
        matchedCount,
        missingCount,
        totalRequiredIngredients,
        baseScore: roundScore(baseScore),
        expiryBonus: roundScore(expiryBonus),
        readyBonus: roundScore(readyBonus),
        oneMissingBonus: roundScore(oneMissingBonus),
        score,
        scoreLabel: `${Math.round(score * 100)}\uC810`,
        canMakeNow: missingCount === 0,
        useSoon: expiringMatchedIngredients.length > 0,
        expiringMatchCount: expiringMatchedIngredients.length,
        recommendationType
      };
    })
    .sort(sortRecommendations);

  return {
    all: recommendations,
    ready: recommendations.filter((recipe) => recipe.recommendationType === 'ready'),
    buyOne: recommendations.filter((recipe) => recipe.recommendationType === 'buyOne'),
    other: recommendations.filter((recipe) => recipe.recommendationType === 'other' && recipe.matchedCount > 0)
  };
}

export function getTopRecommendations(recipes, ingredients, limit = 3) {
  return buildRecipeRecommendations(recipes, ingredients).all.filter((recipe) => recipe.matchedCount > 0).slice(0, limit);
}
