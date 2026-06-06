function clamp(value, min = 0, max = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.min(max, Math.max(min, number));
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase();
}

function uniqueNames(values = []) {
  return [...new Set(values.map(normalizeName).filter(Boolean))];
}

function roundScore(value) {
  return Math.round(value * 10000) / 10000;
}

function buildReason({ matchedIngredients, missingIngredients, expiringMatchedIngredients }) {
  if (matchedIngredients.length && !missingIngredients.length) {
    return 'All known recipe ingredients are available.';
  }

  if (expiringMatchedIngredients.length) {
    return `Uses expiring ingredients: ${expiringMatchedIngredients.slice(0, 3).join(', ')}.`;
  }

  if (matchedIngredients.length) {
    return `Matches available ingredients: ${matchedIngredients.slice(0, 3).join(', ')}.`;
  }

  return 'Semantic similarity found the recipe, but ingredient overlap is limited.';
}

/**
 * @param {{
 *   vectorSimilarity?: number,
 *   availableIngredientNames?: string[],
 *   expiringIngredientNames?: string[],
 *   recipeIngredientNames?: string[],
 *   existingRecommendationScore?: number
 * }} input
 * @returns {{
 *   vectorSimilarity: number,
 *   ownedIngredientRatio: number,
 *   expiringIngredientBonus: number,
 *   missingIngredientPenalty: number,
 *   existingRecommendationScore: number,
 *   matchedIngredients: string[],
 *   missingIngredients: string[],
 *   expiringMatchedIngredients: string[],
 *   finalScore: number,
 *   reason: string
 * }}
 */
export function scoreSemanticRecipeCandidate(input = {}) {
  const vectorSimilarity = clamp(input.vectorSimilarity);
  const existingRecommendationScore = clamp(input.existingRecommendationScore);
  const availableSet = new Set(uniqueNames(input.availableIngredientNames));
  const expiringSet = new Set(uniqueNames(input.expiringIngredientNames));
  const recipeIngredientNames = uniqueNames(input.recipeIngredientNames);
  const matchedIngredients = recipeIngredientNames.filter((name) => availableSet.has(name));
  const missingIngredients = recipeIngredientNames.filter((name) => !availableSet.has(name));
  const expiringMatchedIngredients = matchedIngredients.filter((name) => expiringSet.has(name));
  const ownedIngredientRatio = recipeIngredientNames.length
    ? matchedIngredients.length / recipeIngredientNames.length
    : 0;
  const expiringIngredientBonus = Math.min(0.15, expiringMatchedIngredients.length * 0.05);
  const missingIngredientPenalty = Math.min(0.25, missingIngredients.length * 0.06);
  const weightedScore =
    vectorSimilarity * 0.35 +
    ownedIngredientRatio * 0.35 +
    expiringIngredientBonus * 0.15 +
    existingRecommendationScore * 0.15 -
    missingIngredientPenalty;
  const finalScore = roundScore(clamp(weightedScore));

  return {
    vectorSimilarity: roundScore(vectorSimilarity),
    ownedIngredientRatio: roundScore(ownedIngredientRatio),
    expiringIngredientBonus: roundScore(expiringIngredientBonus),
    missingIngredientPenalty: roundScore(missingIngredientPenalty),
    existingRecommendationScore: roundScore(existingRecommendationScore),
    matchedIngredients,
    missingIngredients,
    expiringMatchedIngredients,
    finalScore,
    reason: buildReason({
      matchedIngredients,
      missingIngredients,
      expiringMatchedIngredients
    })
  };
}
