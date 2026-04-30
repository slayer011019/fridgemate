import { generateRecipeSearchLinks } from '../../../src/features/recipes/recipeSearchLinks.js';
import { normalizeIngredientName } from '../../../src/features/ingredients/ingredientDomain.js';
import { getRecipeMatchScore } from '../../../src/utils/recommendations.js';
import { buildRecipeVectorQueryText, searchSimilarRecipesByVector } from './recipeVectorService.js';

const DEFAULT_STRUCTURED_WEIGHT = 0.7;
const DEFAULT_VECTOR_WEIGHT = 0.3;

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

  const aliases = await prismaClient.ingredientAlias.findMany({
    where: {
      alias: {
        in: normalizedNames
      }
    },
    include: {
      ingredient: true
    }
  });
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
    name: recipe.name,
    category: recipe.category,
    cookingMethod: recipe.cookingMethod,
    rawIngredientsText: recipe.rawIngredientsText,
    ingredients: recipe.ingredients || [],
    searchLinks: generateRecipeSearchLinks(recipe.name)
  };
}

function buildHybridResult(recipe, structuredScore, vectorScore = 0) {
  const finalScore = Math.round((structuredScore.score * DEFAULT_STRUCTURED_WEIGHT + vectorScore * DEFAULT_VECTOR_WEIGHT) * 100) / 100;

  return {
    recipeId: recipe.id,
    id: recipe.id,
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
    matchedIngredients: structuredScore.matchedIngredients,
    missingIngredients: structuredScore.missingIngredients,
    missingSeasonings: structuredScore.missingSeasonings,
    expiringMatchedIngredients: structuredScore.expiringMatchedIngredients,
    matchedCount: structuredScore.matchedIngredients.length,
    missingCount: structuredScore.missingIngredients.length,
    totalRequiredIngredients: (recipe.ingredients || []).filter((ingredient) => ingredient.ingredientType === 'main').length,
    canMakeNow: structuredScore.missingIngredients.length === 0,
    missingCore: structuredScore.missingIngredients,
    matchedCore: structuredScore.matchedIngredients,
    coreIngredients: (recipe.ingredients || [])
      .filter((ingredient) => ingredient.ingredientType === 'main')
      .map((ingredient) => ingredient.normalizedName),
    searchLinks: generateRecipeSearchLinks(recipe.name)
  };
}

/**
 * @param {Array<{name?: string, normalizedName?: string, expiresAt?: string, expiryDate?: string}>} userIngredients
 * @param {{ prismaClient?: Object, limit?: number, vectorSearch?: Function }} [options]
 * @returns {Promise<Array<Object>>}
 */
export async function recommendRecipes(userIngredients = [], options = {}) {
  const prismaClient = await getPrismaClient(options);
  const limit = Number.isFinite(options.limit) ? options.limit : 20;
  const expandedUserIngredients = await expandUserIngredientsWithAliases(userIngredients, prismaClient);
  const recipes = await prismaClient.recipe.findMany({
    include: {
      ingredients: true
    },
    take: Math.max(limit * 5, 50),
    orderBy: {
      updatedAt: 'desc'
    }
  });

  if (!recipes.length) {
    return [];
  }

  const structuredResults = recipes.map((recipe) => {
    const mappedRecipe = mapRecipeForScoring(recipe);
    return {
      recipe: mappedRecipe,
      structuredScore: getRecipeMatchScore(expandedUserIngredients, mappedRecipe.ingredients, {
        recipeId: recipe.id
      })
    };
  });
  const queryText = buildRecipeVectorQueryText(expandedUserIngredients);
  let vectorResults = [];

  try {
    vectorResults = await (options.vectorSearch || searchSimilarRecipesByVector)(queryText, limit, {
      prismaClient
    });
  } catch (_error) {
    vectorResults = [];
  }

  const vectorScoreById = new Map(vectorResults.map((result) => [result.recipeId || result.id, Number(result.vectorScore || 0)]));

  return structuredResults
    .map(({ recipe, structuredScore }) => buildHybridResult(recipe, structuredScore, vectorScoreById.get(recipe.id) || 0))
    .sort((left, right) => right.finalScore - left.finalScore)
    .slice(0, limit);
}
