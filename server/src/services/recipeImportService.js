import {
  buildRecipeEmbeddingText,
  parseFoodSafetyRecipeXml
} from '../../../src/features/recipes/recipeImport.js';
import { createHash } from 'node:crypto';
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

async function updateRecipeEmbedding(prismaClient, recipeId, embeddingText, embedding) {
  const model = process.env.RECIPE_EMBEDDING_MODEL || 'text-embedding-3-small';
  const dimensions = Number(process.env.RECIPE_EMBEDDING_DIMENSIONS || 1536);

  if (embedding.length !== dimensions) {
    throw new Error(`Recipe embedding must include ${dimensions} dimensions.`);
  }

  const contentHash = createHash('sha256').update(embeddingText).digest('hex');
  await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO recipe_embeddings (
        recipe_id,
        embedding_text,
        embedding,
        embedding_model,
        embedding_dimensions,
        content_hash
      )
      VALUES ($1::uuid, $2, $3::vector, $4, $5, $6)
      ON CONFLICT (recipe_id, embedding_model, embedding_dimensions)
      DO UPDATE SET
        embedding_text = EXCLUDED.embedding_text,
        embedding = EXCLUDED.embedding,
        content_hash = EXCLUDED.content_hash,
        updated_at = now()
    `,
    recipeId,
    embeddingText,
    vectorToSqlLiteral(embedding),
    model,
    dimensions,
    contentHash
  );
}

async function getPrismaClient(options = {}) {
  if (options.prismaClient) {
    return options.prismaClient;
  }

  const { prisma } = await import('../db/prisma.js');
  return prisma;
}

async function persistRecipe({ recipe, normalizedIngredients, prismaClient }) {
  const storedRecipe = await prismaClient.recipe.upsert({
    where: {
      externalId: recipe.sourceRecipeId
    },
    create: {
      externalId: recipe.sourceRecipeId,
      source: recipe.source,
      name: recipe.name,
      dishType: recipe.category,
      cookingMethod: recipe.cookingMethod,
      ingredientsText: recipe.rawIngredientsText,
      hashTag: Array.isArray(recipe.tags) ? recipe.tags.join(', ') : null,
      steps: [],
      raw: recipe,
      calories: getNutritionValue(recipe, 'calories'),
      carbohydrate: getNutritionValue(recipe, 'carbohydrate'),
      protein: getNutritionValue(recipe, 'protein'),
      fat: getNutritionValue(recipe, 'fat'),
      sodium: getNutritionValue(recipe, 'sodium')
    },
    update: {
      source: recipe.source,
      name: recipe.name,
      dishType: recipe.category,
      cookingMethod: recipe.cookingMethod,
      ingredientsText: recipe.rawIngredientsText,
      hashTag: Array.isArray(recipe.tags) ? recipe.tags.join(', ') : null,
      raw: recipe,
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
      rawText: [ingredient.rawName, ingredient.displayAmount || ingredient.amountText].filter(Boolean).join(' '),
      rawName: ingredient.rawName || null,
      normalizedName: ingredient.normalizedName || null,
      canonicalName: ingredient.normalizedName || null,
      amount: ingredient.amountValue,
      unit: ingredient.amountUnit || null,
      confidence: ingredient.confidence,
      source: recipe.source
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
      prismaClient
    });

    try {
      const embedding = await (options.generateEmbedding || generateRecipeEmbedding)(embeddingText);
      await updateRecipeEmbedding(prismaClient, storedRecipe.id, embeddingText, embedding);
      results.push({
        recipeId: storedRecipe.id,
        sourceRecipeId: recipe.sourceRecipeId,
        embeddingStatus: 'generated'
      });
    } catch (_error) {
      results.push({
        recipeId: storedRecipe.id,
        sourceRecipeId: recipe.sourceRecipeId,
        embeddingStatus: 'failed'
      });
    }
  }

  return results;
}
