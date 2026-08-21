import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recommendRecipes } from '../recipeHybridRecommendationService.js';

describe('recipeHybridRecommendationService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 1, 12, 0, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('combines structuredScore and vectorScore into finalScore', async () => {
    const prismaClient = {
      ingredientAlias: {
        findMany: vi.fn(async () => [])
      },
      recipe: {
        findMany: vi.fn(async () => [
          {
            id: 'recipe-1',
            name: '새우 두부 계란찜',
            category: '반찬',
            cookingMethod: '찌기',
            rawIngredientsText: '연두부, 새우, 계란',
            ingredients: [
              { rawName: '연두부', normalizedName: '두부', ingredientType: 'main', section: 'main' },
              { rawName: '칵테일새우', normalizedName: '새우', ingredientType: 'main', section: 'main' },
              { rawName: '달걀', normalizedName: '계란', ingredientType: 'main', section: 'main' },
              { rawName: '설탕', normalizedName: '설탕', ingredientType: 'seasoning', section: '양념장' }
            ]
          }
        ])
      }
    };
    const recommendations = await recommendRecipes(
      [
        { name: '순두부', expiryDate: '2026-05-02' },
        { name: '계란' },
        { name: '새우' }
      ],
      {
        prismaClient,
        vectorSearch: async () => [{ recipeId: 'recipe-1', vectorScore: 0.74 }]
      }
    );

    expect(recommendations[0]).toMatchObject({
      recipeId: 'recipe-1',
      name: '새우 두부 계란찜',
      vectorScore: 0.74,
      matchedIngredients: ['두부', '새우', '계란'],
      missingIngredients: [],
      missingSeasonings: ['설탕']
    });
    expect(recommendations[0].finalScore).toBeCloseTo(recommendations[0].structuredScore * 0.7 + 0.74 * 0.3, 2);
  });

  it('counts owned pantry items when scoring database recipes', async () => {
    const prismaClient = {
      ingredientAlias: {
        findMany: vi.fn(async () => [])
      },
      recipe: {
        findMany: vi.fn(async () => [
          {
            id: 'recipe-pantry',
            name: '간장 계란밥',
            category: '한그릇',
            cookingMethod: '비비기',
            rawIngredientsText: '밥, 계란, 간장',
            ingredients: [
              { rawName: '밥', normalizedName: '밥', ingredientType: 'main', section: 'main' },
              { rawName: '달걀', normalizedName: '계란', ingredientType: 'main', section: 'main' },
              { rawName: '간장', normalizedName: '간장', ingredientType: 'main', section: 'main' }
            ]
          }
        ])
      }
    };
    const recommendations = await recommendRecipes([{ name: '밥' }, { name: '계란' }], {
      pantryItems: ['간장'],
      prismaClient,
      vectorSearch: async () => []
    });

    expect(recommendations[0]).toMatchObject({
      recipeId: 'recipe-pantry',
      canMakeNow: true,
      matchedIngredients: ['밥', '계란', '진간장'],
      missingIngredients: []
    });
  });

  it('continues recommendation scoring when the optional alias table is unavailable', async () => {
    const prismaClient = {
      ingredientAlias: {
        findMany: vi.fn(async () => {
          throw new Error('relation ingredient_aliases does not exist');
        })
      },
      recipe: {
        findMany: vi.fn(async () => [
          {
            id: 'recipe-no-aliases',
            name: '계란밥',
            category: '한그릇',
            cookingMethod: '비비기',
            rawIngredientsText: '밥, 계란',
            ingredients: [
              { rawName: '밥', normalizedName: '밥', ingredientType: 'main', section: 'main' },
              { rawName: '계란', normalizedName: '계란', ingredientType: 'main', section: 'main' }
            ]
          }
        ])
      }
    };

    const recommendations = await recommendRecipes([{ name: '밥' }, { name: '계란' }], {
      prismaClient,
      vectorSearch: async () => []
    });

    expect(recommendations[0]).toMatchObject({
      recipeId: 'recipe-no-aliases',
      canMakeNow: true
    });
  });
});
