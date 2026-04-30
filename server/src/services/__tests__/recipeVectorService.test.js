import { describe, expect, it, vi } from 'vitest';
import { buildRecipeVectorQueryText, searchSimilarRecipesByVector } from '../recipeVectorService.js';

describe('recipeVectorService', () => {
  it('builds a fridge ingredient query text for vector search', () => {
    expect(buildRecipeVectorQueryText([{ name: '순두부' }, { name: '계란' }, { name: '새우' }])).toBe(
      '보유 재료: 순두부, 계란, 새우. 만들 수 있는 집밥 메뉴 추천.'
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
      generateEmbedding: async () => [0.1, 0.2, 0.3]
    });

    expect(prismaClient.$queryRawUnsafe).toHaveBeenCalled();
    expect(results[0]).toMatchObject({
      recipeId: 'recipe-1',
      name: '새우 두부 계란찜',
      vectorScore: 0.74
    });
  });
});
