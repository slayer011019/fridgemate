import { generateRecipeSearchLinks } from '../../../src/features/recipes/recipeSearchLinks.js';
import { normalizeIngredientName } from '../../../src/features/ingredients/ingredientDomain.js';
import { getRecipeMatchScore } from '../../../src/utils/recommendations.js';
import { buildRecipeVectorQueryText, searchSimilarRecipesByVector } from './recipeVectorService.js';
import { getProductionRecipesByIds, getRecentProductionRecipes } from './recipeCatalogService.js';

export const DEFAULT_STRUCTURED_WEIGHT = 0.7;
export const DEFAULT_VECTOR_WEIGHT = 0.3;

export function calculateHybridRecommendationScore(structuredScore = 0, vectorScore = 0) {
  return Math.round(
    (Number(structuredScore || 0) * DEFAULT_STRUCTURED_WEIGHT +
      Number(vectorScore || 0) * DEFAULT_VECTOR_WEIGHT) *
      100
  ) / 100;
}

function getIngredientName(ingredient) {
  return typeof ingredient === 'string' ? ingredient : ingredient?.normalizedName || ingredient?.name || '';
}

async function getPrismaClient(options = {}) {
  if (options.prismaClient) {
    return options.prismaClient;
  }

  const { prisma } = await import('../db/prisma.js');
  return prisma;
}

async function expandUserIngredientsWithAliases(userIngredients = [], prismaClient) {
  const normalizedNames = userIngredients.map((ingredient) => normalizeIngredientName(getIngredientName(ingredient))).filter(Boolean);

  if (!normalizedNames.length || !prismaClient.ingredientAlias?.findMany) {
    return userIngredients;
  }

  let aliases = [];

  try {
    aliases = await prismaClient.ingredientAlias.findMany({
      where: {
        alias: {
          in: normalizedNames
        }
      },
      include: {
        ingredient: true
      }
    });
  } catch (_error) {
    return userIngredients;
  }
  const aliasCanonicalNames = aliases.map((alias) => alias.ingredient?.name).filter(Boolean);

  return [
    ...userIngredients,
    ...aliasCanonicalNames.map((name) => ({
      name,
      expiresAt: null
    }))
  ];
}

function mapRecipeForScoring(recipe = {}) {
  return {
    id: recipe.id,
    source: recipe.source,
    externalId: recipe.externalId,
    name: recipe.name,
    category: recipe.category,
    cookingMethod: recipe.cookingMethod,
    rawIngredientsText: recipe.rawIngredientsText,
    ingredients: recipe.ingredients || [],
    searchLinks: generateRecipeSearchLinks(recipe.name)
  };
}

function buildHybridResult(recipe, structuredScore, vectorScore = 0, source = 'hybrid') {
  const finalScore = calculateHybridRecommendationScore(structuredScore.score, vectorScore);
  const mainIngredients = (recipe.ingredients || []).filter((item) => item.ingredientType === 'main');
  const matchedMain = structuredScore.matchedMain || [];
  const missingSeasonings = structuredScore.missingSeasonings || [];
  const missingUnknown = structuredScore.missingUnknown || [];
  const missingGroups = structuredScore.missingGroups || [];
  const canMakeNow = mainIngredients.length > 0 && structuredScore.missingIngredients.length === 0
    && missingSeasonings.length === 0 && missingUnknown.length === 0 && missingGroups.length === 0;
  const preparationReason = canMakeNow
    ? '필요한 재료 종류가 확인됐어요. 원문 분량과 보관 상태를 확인하세요.'
    : !mainIngredients.length
      ? '핵심 재료를 모두 확인하지 못했어요. 원문 재료를 먼저 확인하세요.'
      : structuredScore.missingIngredients.length
        ? `추가로 확인할 핵심 재료: ${structuredScore.missingIngredients.join(', ')}.`
        : missingSeasonings.length
          ? `핵심 재료가 겹쳐요. 양념은 ${missingSeasonings.join(', ')} 등을 확인하세요.`
          : '종류가 확인되지 않은 재료와 필수 재료 조건을 원문에서 확인하세요.';
  const reason = [
    structuredScore.preferredMatches?.length ? `${structuredScore.preferredMatches[0]} 선호를 반영했어요.` : '',
    structuredScore.expiringMatchedIngredients?.length ? `${structuredScore.expiringMatchedIngredients.join(', ')}을 먼저 활용하는 후보예요.` : '',
    preparationReason
  ].filter(Boolean).join(' ');

  return {
    recipeId: recipe.id,
    id: recipe.id,
    source: recipe.source,
    externalId: recipe.externalId,
    name: recipe.name,
    title: recipe.name,
    category: recipe.category,
    cookingMethod: recipe.cookingMethod,
    finalScore,
    score: Math.round(finalScore * 100),
    scoreLabel: `${Math.round(finalScore * 100)}점`,
    matchRate: structuredScore.score,
    matchRateLabel: `${Math.round(structuredScore.score * 100)}%`,
    structuredScore: structuredScore.score,
    vectorScore,
    _recommendationSource: source,
    reason,
    preferredMatches: structuredScore.preferredMatches || [],
    dislikedMatches: structuredScore.dislikedMatches || [],
    matchedIngredients: structuredScore.matchedIngredients,
    missingIngredients: structuredScore.missingIngredients,
    missingSeasonings: structuredScore.missingSeasonings,
    missingUnknownIngredients: structuredScore.missingUnknown || [],
    expiringMatchedIngredients: structuredScore.expiringMatchedIngredients,
    matchedCount: matchedMain.length,
    hasKnownRequirements: mainIngredients.length > 0,
    missingGroups,
    missingCount: structuredScore.missingIngredients.length,
    totalRequiredIngredients: mainIngredients.length,
    canMakeNow,
    missingCore: structuredScore.missingIngredients,
    matchedCore: matchedMain,
    coreIngredients: (recipe.ingredients || [])
      .filter((ingredient) => ingredient.ingredientType === 'main')
      .map((ingredient) => ingredient.normalizedName),
    searchLinks: generateRecipeSearchLinks(recipe.name)
  };
}

/**
 * @param {Array<{name?: string, normalizedName?: string, expiresAt?: string, expiryDate?: string}>} userIngredients
 * @param {{ prismaClient?: Object, limit?: number, pantryItems?: string[], vectorSearch?: Function }} [options]
 * @returns {Promise<Array<Object>>}
 */
export async function recommendRecipes(userIngredients = [], options = {}) {
  const prismaClient = await getPrismaClient(options);
  const limit = Number.isFinite(options.limit) ? options.limit : 20;
  const candidateCount = Number.isFinite(options.candidateCount)
    ? Math.max(limit, Math.min(500, Math.floor(options.candidateCount)))
    : Math.max(limit * 5, 50);
  const expandedUserIngredients = await expandUserIngredientsWithAliases(userIngredients, prismaClient);
  const queryText = buildRecipeVectorQueryText(expandedUserIngredients);
  let vectorResults = [];

  try {
    vectorResults = await (options.vectorSearch || searchSimilarRecipesByVector)(queryText, candidateCount, {
      prismaClient,
      externalAi: options.externalAi
    });
  } catch (_error) {
    vectorResults = [];
  }

  const recipeIds = vectorResults.map((result) => result.recipeId || result.id).filter(Boolean);
  const loadRecipesByIds = options.loadRecipesByIds || getProductionRecipesByIds;
  const loadRecentRecipes = options.loadRecentRecipes || getRecentProductionRecipes;
  const recipes = recipeIds.length
    ? await loadRecipesByIds(prismaClient, recipeIds)
    : await loadRecentRecipes(prismaClient, candidateCount);

  if (!recipes.length) {
    return [];
  }

  const structuredResults = recipes.map((recipe) => {
    const mappedRecipe = mapRecipeForScoring(recipe);
    return {
      recipe: mappedRecipe,
      structuredScore: getRecipeMatchScore(expandedUserIngredients, mappedRecipe.ingredients, {
        recipeId: recipe.id,
        pantryItems: options.pantryItems,
        preferences: options.preferences
      })
    };
  });
  const vectorScoreById = new Map(vectorResults.map((result) => [result.recipeId || result.id, Number(result.vectorScore || 0)]));
  const recommendationSource = vectorResults.length ? 'hybrid' : 'rule';

  return structuredResults
    .map(({ recipe, structuredScore }) =>
      buildHybridResult(recipe, structuredScore, vectorScoreById.get(recipe.id) || 0, recommendationSource)
    )
    .sort((left, right) => right.finalScore - left.finalScore)
    .slice(0, limit);
}
