import { describe, expect, it, vi } from 'vitest';
import { importFoodSafetyRecipesFromXml } from '../recipeImportService.js';
import { readFileSync } from 'node:fs';

const xmlFixture = readFileSync('src/features/recipes/__tests__/fixtures/foodSafetyRecipes.xml', 'utf8');

function createPrismaClientMock() {
  return {
    recipe: {
      upsert: vi.fn(async ({ create }) => ({
        id: `recipe-${create.externalId}`,
        ...create
      }))
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
    expect(prismaClient.recipeIngredient.createMany).toHaveBeenCalled();
    expect(prismaClient.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('stores generated embeddings in the recipe_embeddings sidecar table', async () => {
    const prismaClient = createPrismaClientMock();
    const results = await importFoodSafetyRecipesFromXml(xmlFixture, {
      prismaClient,
      normalizeIngredients: async (ingredients) => ingredients,
      generateEmbedding: async () => Array.from({ length: 1536 }, () => 0.01)
    });

    expect(results.every((result) => result.embeddingStatus === 'generated')).toBe(true);
    expect(prismaClient.$executeRawUnsafe).toHaveBeenCalledTimes(5);
    expect(prismaClient.$executeRawUnsafe.mock.calls[0][0]).toContain('INSERT INTO recipe_embeddings');
    expect(prismaClient.$executeRawUnsafe.mock.calls[0][0]).not.toContain('UPDATE recipes SET embedding');
  });
});
