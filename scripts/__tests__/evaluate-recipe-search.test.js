import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { evaluateRecipeSearch } from '../evaluate-recipe-search.js';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';
const HOME_MEAL_FIXTURE = JSON.parse(
  readFileSync('scripts/fixtures/recipe-search-home-meal-evaluation.json', 'utf8')
);

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
  it('keeps a balanced realistic fixture separate from the UUID regression fixture', () => {
    expect(HOME_MEAL_FIXTURE.recipes).toHaveLength(20);
    expect(new Set(HOME_MEAL_FIXTURE.recipes.map((recipe) => recipe.category)).size).toBeGreaterThanOrEqual(8);
    HOME_MEAL_FIXTURE.recipes.forEach((recipe) => {
      expect(recipe.externalId).toBeTruthy();
      expect(recipe.availableIngredients.length).toBeGreaterThanOrEqual(3);
      expect(recipe.availableIngredients.length).toBeLessThanOrEqual(6);
      expect(recipe.expiringIngredients.length).toBeGreaterThanOrEqual(1);
    });
    const allIngredients = HOME_MEAL_FIXTURE.recipes.flatMap((recipe) => recipe.availableIngredients);
    expect(allIngredients).toContain('계란');
    expect(allIngredients).toContain('달걀');
    expect(allIngredients).toContain('파');
    expect(allIngredients).toContain('대파');
  });

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
      hitAt5Rate: 1,
      candidatePoolRecall: '2/2',
      rerankedHitAt5: '2/2',
      rerankedHitAt5Rate: 1,
      minimumHitAt5Rate: 0.7,
      fullBackfillGate: 'Go',
      semanticApiGate: 'Go'
    });
    expect(report.preflight.productionWrites).toBe(0);
    expect(report.results.map((result) => result.id)).toEqual([ID_A, ID_B]);
    expect(report.results[0]).toMatchObject({
      targetSimilarity: 1,
      rerankedRank: 1,
      rerankedHit5: true,
      queryIngredientClassifications: [{ name: '감자', type: 'unknown', reason: 'insufficient-evidence' }],
      candidateIngredientClassifications: [{ name: '감자', type: 'main', reason: 'explicit-category' }]
    });
    expect(generateBatch).toHaveBeenCalledTimes(1);
    expect(prismaClient.$executeRawUnsafe).toBeUndefined();
  });

  it('embeds only fixture queries when evaluating stored vectors', async () => {
    const prismaClient = createPrismaClient();
    prismaClient.$queryRawUnsafe.mockImplementation(async (sql, vectorLiteral) => {
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
      if (sql.includes('ORDER BY re.embedding')) {
        return vectorLiteral === '[1,0,0]'
          ? [{ id: ID_A, similarity: 1 }, { id: ID_B, similarity: 0 }]
          : [{ id: ID_B, similarity: 1 }, { id: ID_A, similarity: 0 }];
      }
      if (sql.includes('FROM recipe_embeddings')) return [{ count: 2 }];
      return [];
    });
    const generateBatch = vi.fn(async (texts) => {
      expect(texts).toHaveLength(2);
      return [[1, 0, 0], [0, 1, 0]];
    });

    const report = await evaluateRecipeSearch({
      dryRun: false,
      storedVectors: true,
      limit: 10,
      dimensions: 3,
      apiKey: 'test-key',
      prismaClient,
      generateBatch,
      fixture: {
        version: 2,
        profile: 'realistic-home-meal-test',
        recipes: [
          {
            externalId: 'a',
            name: '감자볶음',
            availableIngredients: ['감자', '양파'],
            expiringIngredients: ['감자']
          },
          {
            externalId: 'b',
            name: '계란찜',
            availableIngredients: ['달걀', '대파'],
            expiringIngredients: ['달걀']
          }
        ]
      }
    });

    expect(report.preflight).toMatchObject({
      evaluationSource: 'stored-production-vectors',
      totalEmbeddingInputs: 2,
      expectedApiRequests: 1,
      productionWrites: 0
    });
    expect(report.metrics).toMatchObject({
      hitAt1: '2/2',
      hitAt5: '2/2',
      candidatePoolRecall: '2/2',
      rerankedHitAt5: '2/2',
      apiRequestCount: 1,
      unavailableTargetCount: 0
    });
    expect(report.results[0]).toMatchObject({
      externalId: 'a',
      availableIngredients: ['감자', '양파'],
      expiringIngredients: ['감자']
    });
    expect(report.results[0].top5[0]).toMatchObject({ ownedIngredientRatio: expect.any(Number) });
    expect(generateBatch).toHaveBeenCalledTimes(1);
  });
});
