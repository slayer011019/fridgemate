import { describe, expect, it, vi } from 'vitest';
import { evaluateRecipeSearch } from '../evaluate-recipe-search.js';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

function createPrismaClient() {
  return {
    $queryRawUnsafe: vi.fn(async (sql) => {
      if (sql.includes('WITH selected_recipes')) {
        return [
          {
            recipe_id: ID_A,
            external_id: 'a',
            name: '감자볶음',
            dish_type: '반찬',
            cooking_method: '볶기',
            ingredient_id: 'ia',
            raw_text: '감자 1개',
            raw_name: '감자',
            normalized_name: '감자'
          },
          {
            recipe_id: ID_B,
            external_id: 'b',
            name: '계란찜',
            dish_type: '반찬',
            cooking_method: '찌기',
            ingredient_id: 'ib',
            raw_text: '계란 2개',
            raw_name: '계란',
            normalized_name: '계란'
          }
        ];
      }
      if (sql.includes('FROM recipe_embeddings')) return [{ count: 2 }];
      return [];
    })
  };
}

describe('recipe search evaluation', () => {
  it('replays a fixed fixture in memory without database writes', async () => {
    const prismaClient = createPrismaClient();
    const generateBatch = vi.fn(async () => [
      [1, 0, 0],
      [0, 1, 0],
      [1, 0, 0],
      [0, 1, 0]
    ]);
    const report = await evaluateRecipeSearch({
      dryRun: false,
      limit: 10,
      dimensions: 3,
      apiKey: 'test-key',
      prismaClient,
      generateBatch,
      fixture: {
        recipes: [
          { id: ID_A, name: '감자볶음' },
          { id: ID_B, name: '계란찜' }
        ]
      }
    });

    expect(report.metrics).toMatchObject({
      hitAt1: '2/2',
      hitAt5: '2/2',
      fullBackfillGate: 'No-Go'
    });
    expect(report.preflight.productionWrites).toBe(0);
    expect(report.results.map((result) => result.id)).toEqual([ID_A, ID_B]);
    expect(report.results[0]).toMatchObject({
      targetSimilarity: 1,
      queryIngredientClassifications: [{ name: '감자', type: 'unknown', reason: 'insufficient-evidence' }],
      candidateIngredientClassifications: [{ name: '감자', type: 'main', reason: 'explicit-category' }]
    });
    expect(generateBatch).toHaveBeenCalledTimes(1);
    expect(prismaClient.$executeRawUnsafe).toBeUndefined();
  });
});
