import { getAiRecipeSuggestions, getRecipeRecommendations } from '../services/recipeService.js';
import { createHttpError } from '../lib/httpError.js';
import { normalizeIngredientName } from '../../../src/features/ingredients/ingredientDomain.js';

const SEMANTIC_REQUEST_FIELDS = new Set([
  'availableIngredients',
  'expiringIngredients',
  'pantryItems',
  'limit',
  'candidateCount'
]);

function normalizeStringList(value, name, maxItems = 50) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxItems) {
    throw createHttpError(400, `${name} must be an array with at most ${maxItems} items.`);
  }

  const normalized = value.map((item) => {
    const rawName = typeof item === 'string' ? item : item?.name;
    const ingredientName = String(rawName || '').trim();
    if (!ingredientName || ingredientName.length > 100) {
      throw createHttpError(400, `${name} contains an invalid ingredient name.`);
    }
    return ingredientName;
  });

  return [...new Set(normalized)];
}

function normalizeInteger(value, name, fallback, min, max) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw createHttpError(400, `${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

export function normalizeSemanticRecipeRequest(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createHttpError(400, 'Semantic recipe request must be an object.');
  }
  if (Object.keys(body).some((field) => !SEMANTIC_REQUEST_FIELDS.has(field))) {
    throw createHttpError(400, 'Semantic recipe request contains unsupported fields.');
  }

  const availableIngredients = normalizeStringList(body.availableIngredients, 'availableIngredients');
  const expiringIngredients = normalizeStringList(body.expiringIngredients, 'expiringIngredients');
  const pantryItems = normalizeStringList(body.pantryItems, 'pantryItems', 100);
  const limit = normalizeInteger(body.limit, 'limit', 10, 1, 20);
  const candidateCount = normalizeInteger(body.candidateCount, 'candidateCount', 100, limit, 250);
  const expiringSet = new Set(expiringIngredients.map(normalizeIngredientName));

  if (!availableIngredients.length) {
    throw createHttpError(400, 'availableIngredients must include at least one ingredient.');
  }

  return {
    ingredients: availableIngredients.map((name) => ({
      name,
      expiresAt: expiringSet.has(normalizeIngredientName(name)) ? new Date().toISOString() : null
    })),
    pantryItems,
    limit,
    candidateCount
  };
}

export async function getRecipeRecommendationsHandler(request, response, next) {
  try {
    const bodyIngredients = Array.isArray(request.body?.ingredients) ? request.body.ingredients : null;
    const pantryItems = Array.isArray(request.body?.pantryItems) ? request.body.pantryItems : [];
    const recommendations = await getRecipeRecommendations({
      userId: request.auth.userId,
      ingredients: bodyIngredients,
      pantryItems
    });

    response.json(recommendations);
  } catch (error) {
    next(error);
  }
}

export async function getAiRecipeSuggestionsHandler(request, response, next) {
  try {
    const ingredients = Array.isArray(request.body?.ingredients) ? request.body.ingredients : [];
    const suggestions = await getAiRecipeSuggestions(ingredients);
    response.json(suggestions);
  } catch (error) {
    next(error);
  }
}

export async function getSemanticRecipeRecommendationsHandler(request, response, next) {
  try {
    const input = normalizeSemanticRecipeRequest(request.body);
    const recommendations = await getRecipeRecommendations({
      userId: request.auth.userId,
      ...input,
      requireSemantic: true
    });
    const mode = recommendations.some((recipe) => recipe._recommendationSource === 'hybrid')
      ? 'semantic'
      : 'rule-fallback';

    response.json({
      mode,
      recommendations,
      meta: {
        limit: input.limit,
        candidateCount: input.candidateCount
      }
    });
  } catch (error) {
    next(error);
  }
}
