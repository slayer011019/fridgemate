import { withUserDatabaseScope } from '../db/tenantScope.js';
import { serverConfig } from '../config.js';
import { seedRecipes } from '../../../src/data/seedRecipes.js';
import { buildRecipeRecommendations } from '../../../src/utils/recommendations.js';
import { recommendRecipes as recommendHybridRecipes } from './recipeHybridRecommendationService.js';
import {
  recordRecommendationFallback,
  recordSemanticRecommendationOutcome
} from '../lib/operationalTelemetry.js';
import {
  EXTERNAL_AI_ACTIONS,
  assertExternalAiOperationAllowed,
  isExternalAiOperationAllowed,
  normalizeExternalAiText
} from '../lib/externalAiPrivacy.js';
import { requestExternalAiJson } from '../lib/externalAiRequest.js';

const MAX_STORED_RECOMMENDATION_INGREDIENTS = 50;

function buildFallbackAiSuggestions(ingredients = []) {
  return buildRecipeRecommendations(seedRecipes, ingredients)
    .filter((recipe) => recipe.score > 0)
    .slice(0, 6)
    .map((recipe) => ({
      title: recipe.title,
      description: recipe.description,
      ingredients: [...recipe.coreIngredients, ...recipe.optionalIngredients.slice(0, 3)],
      cookingTime: recipe.cookingTime,
      difficulty: recipe.difficulty || '보통',
      tags: recipe.tags || []
    }));
}

function buildAiPrompt(ingredients = []) {
  const formattedIngredients = ingredients.map((ingredient) => ({
    name: ingredient.name,
    useSoon: ingredient.expiresSoon === true || isIngredientExpiringSoon(ingredient.expiresAt)
  }));

  return [
    'You are generating recipe suggestions for a fridge-management app.',
    'Prioritize ingredients expiring within 3 days and try to reduce food waste.',
    'You may suggest creative recipes that are not included in the local seed recipes.',
    'Return only a JSON array. Do not include markdown, comments, or explanations.',
    'Each item must have exactly these keys: title, description, ingredients, cookingTime, difficulty, tags.',
    'difficulty must be one of: 쉬움, 보통, 어려움.',
    'ingredients and tags must be arrays of strings.',
    '',
    `Available ingredients: ${JSON.stringify(formattedIngredients)}`
  ].join('\n');
}

function isIngredientExpiringSoon(expiresAt) {
  if (!expiresAt) return false;
  const expiryTime = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiryTime)) return false;
  const remainingDays = (expiryTime - Date.now()) / (24 * 60 * 60 * 1000);
  return remainingDays >= -1 && remainingDays <= 3;
}

function parseClaudeJson(text) {
  const trimmed = String(text || '').trim();
  const withoutFence = trimmed.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const parsed = JSON.parse(withoutFence);

  if (!Array.isArray(parsed)) {
    throw new Error('Claude response was not a JSON array.');
  }

  return parsed.map((item, index) => ({
    title: String(item?.title || `AI 추천 레시피 ${index + 1}`).trim(),
    description: String(item?.description || '').trim(),
    ingredients: Array.isArray(item?.ingredients) ? item.ingredients.map((value) => String(value).trim()).filter(Boolean) : [],
    cookingTime: String(item?.cookingTime || '').trim(),
    difficulty: ['쉬움', '보통', '어려움'].includes(item?.difficulty) ? item.difficulty : '보통',
    tags: Array.isArray(item?.tags) ? item.tags.map((value) => String(value).trim()).filter(Boolean) : []
  }));
}

function isActiveRecommendationIngredient(ingredient) {
  if (!ingredient || typeof ingredient !== 'object') {
    return true;
  }

  const hasDeletionTimestamp =
    ingredient.deletedAt !== undefined &&
    ingredient.deletedAt !== null &&
    ingredient.deletedAt !== '';

  return !hasDeletionTimestamp && ingredient.consumed !== true;
}

function filterActiveRecommendationIngredients(ingredients = []) {
  return Array.isArray(ingredients) ? ingredients.filter(isActiveRecommendationIngredient) : [];
}

async function getStoredIngredients(userId) {
  const ingredients = await withUserDatabaseScope(userId, (database) =>
    database.ingredient.findMany({
      where: {
        userId,
        deletedAt: null,
        consumed: false
      },
      select: {
        name: true,
        expiryDate: true,
        consumed: true,
        deletedAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_STORED_RECOMMENDATION_INGREDIENTS
    })
  );

  return ingredients
    .slice(0, MAX_STORED_RECOMMENDATION_INGREDIENTS)
    .map((ingredient) => ({
      name: ingredient.name,
      expiresAt: ingredient.expiryDate || null,
      consumed: ingredient.consumed,
      deletedAt: ingredient.deletedAt
    }));
}

async function requestClaudeSuggestions(ingredients = [], { externalAi, fetchImpl, timeoutMs } = {}) {
  assertExternalAiOperationAllowed(externalAi, EXTERNAL_AI_ACTIONS.aiRecipeSuggestions);
  const providerIngredients = filterActiveRecommendationIngredients(ingredients)
    .slice(0, MAX_STORED_RECOMMENDATION_INGREDIENTS)
    .map((ingredient) => ({
      name: normalizeExternalAiText(
        typeof ingredient === 'string' ? ingredient : ingredient?.name,
        'AI recipe ingredient'
      ),
      expiresSoon: ingredient?.expiresSoon === true
    }));

  const { payload } = await requestExternalAiJson({
    provider: 'Anthropic recipe suggestions',
    url: 'https://api.anthropic.com/v1/messages',
    fetchImpl: fetchImpl ?? globalThis.fetch,
    timeoutMs,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': serverConfig.anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1400,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: buildAiPrompt(providerIngredients)
          }
        ]
      })
    }
  });
  const text = Array.isArray(payload?.content)
    ? payload.content
        .filter((item) => item?.type === 'text')
        .map((item) => item.text)
        .join('\n')
    : '';

  return parseClaudeJson(text);
}

export async function getRecipeRecommendations({
  userId,
  ingredients,
  pantryItems = [],
  preferences = {},
  limit,
  candidateCount,
  requireSemantic = false,
  externalAi = null
} = {}) {
  const sourceIngredients =
    Array.isArray(ingredients) && ingredients.length ? ingredients : await getStoredIngredients(userId);
  const inputIngredients = filterActiveRecommendationIngredients(sourceIngredients);

  const semanticAllowed = Boolean(
    requireSemantic &&
      serverConfig.semanticRecipeApiEnabled &&
      isExternalAiOperationAllowed(externalAi, EXTERNAL_AI_ACTIONS.semanticRecipes)
  );
  const semanticStartedAt = semanticAllowed ? Date.now() : null;

  try {
    const catalogRecommendations = await recommendHybridRecipes(inputIngredients, {
      pantryItems,
      preferences,
      limit,
      candidateCount,
      ...(semanticAllowed
        ? { externalAi }
        : { vectorSearch: async () => [] })
    });

    if (catalogRecommendations.length) {
      if (semanticAllowed) {
        recordSemanticRecommendationOutcome({
          mode: catalogRecommendations.some((recipe) => recipe._recommendationSource === 'hybrid')
            ? 'semantic'
            : 'rule-fallback',
          recommendationCount: catalogRecommendations.length,
          durationMs: Date.now() - semanticStartedAt
        });
      }
      return catalogRecommendations;
    }
  } catch (error) {
    recordRecommendationFallback('catalog_recipe_recommendations', error);
  }

  const fallback = buildRecipeRecommendations(seedRecipes, inputIngredients, { pantryItems, preferences })
    .map((recipe) => ({ ...recipe, _recommendationSource: 'rule' }));

  if (semanticAllowed) {
    recordSemanticRecommendationOutcome({
      mode: 'rule-fallback',
      recommendationCount: Number.isFinite(limit) ? Math.min(fallback.length, limit) : fallback.length,
      durationMs: Date.now() - semanticStartedAt
    });
  }

  return Number.isFinite(limit) ? fallback.slice(0, limit) : fallback;
}

export async function getAiRecipeSuggestions(ingredients = [], { externalAi, fetchImpl, timeoutMs } = {}) {
  if (!ingredients.length) {
    return [];
  }

  if (
    !serverConfig.anthropicApiKey ||
    !isExternalAiOperationAllowed(externalAi, EXTERNAL_AI_ACTIONS.aiRecipeSuggestions)
  ) {
    return buildFallbackAiSuggestions(ingredients);
  }

  try {
    return await requestClaudeSuggestions(ingredients, { externalAi, fetchImpl, timeoutMs });
  } catch (error) {
    recordRecommendationFallback('anthropic_recipe_suggestions', error);
    return buildFallbackAiSuggestions(ingredients);
  }
}
