import {
  buildRecipeEmbeddingText,
  parseFoodSafetyRecipeXml
} from '../../../src/features/recipes/recipeImport.js';
import { normalizeIngredientsWithLLM } from './recipeNormalizationService.js';
import { generateRecipeEmbedding } from './recipeEmbeddingService.js';

function vectorToSqlLiteral(vector = []) {
  if (!Array.isArray(vector) || !vector.every((value) => Number.isFinite(value))) {
    throw new Error('Embedding must be a numeric vector.');
  }

  return `[${vector.join(',')}]`;
}

function getNutritionValue(recipe, key) {
  return recipe.nutrition?.[key] ?? null;
}

async function updateRecipeEmbedding(prismaClient, recipeId, embedding) {
  await prismaClient.$executeRawUnsafe(
    'UPDATE recipes SET embedding = $1::vector, embedding_status = $2 WHERE id = $3',
    vectorToSqlLiteral(embedding),
    'generated',
    recipeId
  );
}

async function markEmbeddingFailed(prismaClient, recipeId) {
  await prismaClient.recipe.update({
    where: {
      id: recipeId
    },
    data: {
      embeddingStatus: 'failed'
    }
  });
}

async function getPrismaClient(options = {}) {
  if (options.prismaClient) {
    return options.prismaClient;
  }

  const { prisma } = await import('../db/prisma.js');
  return prisma;
}

async function persistRecipe({ recipe, normalizedIngredients, embeddingText, prismaClient }) {
  await prismaClient.rawRecipe.upsert({
    where: {
      source_sourceRecipeId: {
        source: recipe.source,
        sourceRecipeId: recipe.sourceRecipeId
      }
    },
    create: {
      source: recipe.source,
      sourceRecipeId: recipe.sourceRecipeId,
      rawPayload: recipe,
      rawIngredientsText: recipe.rawIngredientsText
    },
    update: {
      rawPayload: recipe,
      rawIngredientsText: recipe.rawIngredientsText
    }
  });

  const storedRecipe = await prismaClient.recipe.upsert({
    where: {
      source_sourceRecipeId: {
        source: recipe.source,
        sourceRecipeId: recipe.sourceRecipeId
      }
    },
    create: {
      source: recipe.source,
      sourceRecipeId: recipe.sourceRecipeId,
      name: recipe.name,
      category: recipe.category,
      cookingMethod: recipe.cookingMethod,
      rawIngredientsText: recipe.rawIngredientsText,
      tags: recipe.tags,
      embeddingText,
      embeddingStatus: 'pending',
      calories: getNutritionValue(recipe, 'calories'),
      carbohydrate: getNutritionValue(recipe, 'carbohydrate'),
      protein: getNutritionValue(recipe, 'protein'),
      fat: getNutritionValue(recipe, 'fat'),
      sodium: getNutritionValue(recipe, 'sodium')
    },
    update: {
      name: recipe.name,
      category: recipe.category,
      cookingMethod: recipe.cookingMethod,
      rawIngredientsText: recipe.rawIngredientsText,
      tags: recipe.tags,
      embeddingText,
      embeddingStatus: 'pending',
      calories: getNutritionValue(recipe, 'calories'),
      carbohydrate: getNutritionValue(recipe, 'carbohydrate'),
      protein: getNutritionValue(recipe, 'protein'),
      fat: getNutritionValue(recipe, 'fat'),
      sodium: getNutritionValue(recipe, 'sodium'),
      ingredients: {
        deleteMany: {}
      }
    }
  });

  await prismaClient.recipeIngredient.createMany({
    data: normalizedIngredients.map((ingredient) => ({
      recipeId: storedRecipe.id,
      rawName: ingredient.rawName,
      normalizedName: ingredient.normalizedName,
      section: ingredient.section,
      amountText: ingredient.amountText || null,
      amountValue: ingredient.amountValue,
      amountUnit: ingredient.amountUnit || null,
      displayAmount: ingredient.displayAmount || null,
      ingredientType: ingredient.ingredientType,
      confidence: ingredient.confidence
    }))
  });

  return storedRecipe;
}

/**
 * @param {string} xmlText
 * @param {{ prismaClient?: Object, normalizeIngredients?: Function, generateEmbedding?: Function }} [options]
 * @returns {Promise<Array<{recipeId: string, sourceRecipeId: string, embeddingStatus: string}>>}
 */
export async function importFoodSafetyRecipesFromXml(xmlText, options = {}) {
  const prismaClient = await getPrismaClient(options);
  const parsedRecipes = parseFoodSafetyRecipeXml(xmlText);
  const results = [];

  for (const recipe of parsedRecipes) {
    const normalizedIngredients = await (options.normalizeIngredients || normalizeIngredientsWithLLM)(recipe.ingredients);
    const embeddingText = buildRecipeEmbeddingText(recipe, normalizedIngredients);
    const storedRecipe = await persistRecipe({
      recipe,
      normalizedIngredients,
      embeddingText,
      prismaClient
    });

    try {
      const embedding = await (options.generateEmbedding || generateRecipeEmbedding)(embeddingText);
      await updateRecipeEmbedding(prismaClient, storedRecipe.id, embedding);
      results.push({
        recipeId: storedRecipe.id,
        sourceRecipeId: recipe.sourceRecipeId,
        embeddingStatus: 'generated'
      });
    } catch (_error) {
      await markEmbeddingFailed(prismaClient, storedRecipe.id);
      results.push({
        recipeId: storedRecipe.id,
        sourceRecipeId: recipe.sourceRecipeId,
        embeddingStatus: 'failed'
      });
    }
  }

  return results;
}
