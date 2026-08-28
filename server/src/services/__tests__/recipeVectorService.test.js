import { describe, expect, it, vi } from 'vitest';
import { buildRecipeVectorQueryText, searchSimilarRecipesByVector } from '../recipeVectorService.js';

describe('recipeVectorService', () => {
  it('builds a fridge ingredient query text for vector search', () => {
    expect(buildRecipeVectorQueryText([{ name: '순두부' }, { name: '계란' }, { name: '새우' }])).toBe(
      '검색재료: 계란, 두부, 새우'
    );
  });

  it('separates common seasonings from core query ingredients', () => {
    expect(buildRecipeVectorQueryText(['밥', '계란', '간장', '물'])).toBe(
      ['검색재료: 계란, 밥', '양념: 진간장'].join('\n')
    );
  });

  it('keeps pgvector search behind a dedicated function and includes vectorScore', async () => {
    const prismaClient = {
      $queryRawUnsafe: vi.fn(async () => [
        {
          id: 'recipe-1',
          name: '새우 두부 계란찜',
          category: '반찬',
          cooking_method: '찌기',
          raw_ingredients_text: '연두부, 새우, 계란',
          vectorScore: 0.74
        }
      ])
    };
    const results = await searchSimilarRecipesByVector('query', 20, {
      prismaClient,
      model: 'test-model',
      dimensions: 3,
      generateEmbedding: async () => [0.1, 0.2, 0.3]
    });

    expect(prismaClient.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('FROM recipe_embeddings re'),
      '[0.1,0.2,0.3]',
      'test-model',
      3
    );
    expect(prismaClient.$queryRawUnsafe.mock.calls[0][0]).toContain('JOIN recipes r ON r.id = re.recipe_id');
    expect(prismaClient.$queryRawUnsafe.mock.calls[0][0]).not.toContain('WHERE embedding IS NOT NULL');
    expect(results[0]).toMatchObject({
      recipeId: 'recipe-1',
      name: '새우 두부 계란찜',
      vectorScore: 0.74
    });
  });

  it('rejects a query embedding with the wrong dimensions before running SQL', async () => {
    const prismaClient = {
      $queryRawUnsafe: vi.fn()
    };

    await expect(
      searchSimilarRecipesByVector('query', 20, {
        prismaClient,
        dimensions: 3,
        generateEmbedding: async () => [0.1, 0.2]
      })
    ).rejects.toThrow('Recipe query embedding must include 3 dimensions.');
    expect(prismaClient.$queryRawUnsafe).not.toHaveBeenCalled();
  });
});
