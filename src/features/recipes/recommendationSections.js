import { getActiveIngredients } from '../ingredients/ingredientSelectors';

export const BASIC_RECIPE_INGREDIENTS = ['계란', '양파', '대파', '두부', '버섯'];

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

export function getMissingBasicIngredients(ingredients = [], basics = BASIC_RECIPE_INGREDIENTS, limit = 5) {
  const ownedIngredients = new Set(getActiveIngredients(ingredients).map((ingredient) => normalizeName(ingredient.name)));

  return basics.filter((ingredient) => !ownedIngredients.has(normalizeName(ingredient))).slice(0, limit);
}

export function getSectionHelperText(count, emptyText, lowText, positiveText) {
  if (!count) {
    return emptyText;
  }

  if (count <= 2) {
    return lowText;
  }

  return positiveText;
}

export function splitRecommendationsByReadiness(recommendations = []) {
  return recommendations.reduce(
    (groups, recommendation) => {
      if (recommendation.canMakeNow) {
        groups.ready.push(recommendation);
        return groups;
      }

      const matchedCoreCount = Array.isArray(recommendation.matchedCore)
        ? recommendation.matchedCore.length
        : Number(recommendation.matchedCount || 0);

      if (recommendation.missingCore.length === 1 && matchedCoreCount > 0) {
        groups.buyOneMore.push(recommendation);
        return groups;
      }

      if (recommendation.score > 0) {
        groups.useSoon.push(recommendation);
      }

      return groups;
    },
    {
      ready: [],
      buyOneMore: [],
      useSoon: []
    }
  );
}
