import { describe, expect, it, vi } from 'vitest';
import { importFoodSafetyRecipesFromXml } from '../recipeImportService.js';
import { readFileSync } from 'node:fs';

const xmlFixture = readFileSync('src/features/recipes/__tests__/fixtures/foodSafetyRecipes.xml', 'utf8');

function createPrismaClientMock() {
  return {
    rawRecipe: {
      upsert: vi.fn(async () => ({}))
    },
    recipe: {
      upsert: vi.fn(async ({ create }) => ({
        id: `recipe-${create.sourceRecipeId}`,
        ...create
      })),
      update: vi.fn(async () => ({}))
    },
    recipeIngredient: {
      createMany: vi.fn(async () => ({ count: 1 }))
    },
    $executeRawUnsafe: vi.fn(async () => ({}))
  };
}

describe('recipeImportService', () => {
  it('imports parsed recipes and marks embedding failures without aborting the import', async () => {
    const prismaClient = createPrismaClientMock();
    const results = await importFoodSafetyRecipesFromXml(xmlFixture, {
      prismaClient,
      normalizeIngredients: async (ingredients) => ingredients,
      generateEmbedding: async () => {
        throw new Error('embedding failed');
      }
    });

    expect(results).toHaveLength(5);
    expect(results.every((result) => result.embeddingStatus === 'failed')).toBe(true);
    expect(prismaClient.rawRecipe.upsert).toHaveBeenCalled();
    expect(prismaClient.recipeIngredient.createMany).toHaveBeenCalled();
    expect(prismaClient.recipe.update).toHaveBeenCalled();
  });
});
