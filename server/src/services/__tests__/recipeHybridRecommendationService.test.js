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
      }
    };
    const recipes = [
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
    ];
    const loadRecipesByIds = vi.fn(async () => recipes);
    const recommendations = await recommendRecipes(
      [
        { name: '순두부', expiryDate: '2026-05-02' },
        { name: '계란' },
        { name: '새우' }
      ],
      {
        prismaClient,
        vectorSearch: async () => [{ recipeId: 'recipe-1', vectorScore: 0.74 }],
        loadRecipesByIds
      }
    );

    expect(loadRecipesByIds).toHaveBeenCalledWith(prismaClient, ['recipe-1']);
    expect(recommendations[0]).toMatchObject({
      recipeId: 'recipe-1',
      name: '새우 두부 계란찜',
      vectorScore: 0.74,
      _recommendationSource: 'hybrid',
      matchedIngredients: ['두부', '새우', '계란'],
      missingIngredients: [],
      missingSeasonings: ['설탕'],
      canMakeNow: false
    });
    expect(recommendations[0].finalScore).toBeCloseTo(recommendations[0].structuredScore * 0.7 + 0.74 * 0.3, 2);
  });

  it('preserves a verified catalog source identity for exact public detail links', async () => {
    const recommendations = await recommendRecipes([{ name: '계란' }], {
      prismaClient: {},
      vectorSearch: async () => [],
      loadRecentRecipes: async () => [{
        id: 'database-uuid',
        externalId: '28',
        source: 'food_safety_korea',
        name: '새우 두부 계란찜',
        ingredients: [{ normalizedName: '계란', ingredientType: 'main' }]
      }]
    });

    expect(recommendations[0]).toMatchObject({
      id: 'database-uuid', externalId: '28', source: 'food_safety_korea'
    });
  });

  it('counts only main matches in the main-ingredient fraction while retaining optional matches separately', async () => {
    const recommendations = await recommendRecipes([{ name: '두부' }, { name: '대파' }, { name: '참깨' }], {
      prismaClient: {},
      vectorSearch: async () => [],
      loadRecentRecipes: async () => [{
        id: 'optional-heavy', name: '두부 메뉴', ingredients: [
          { normalizedName: '두부', ingredientType: 'main' },
          { normalizedName: '대파', ingredientType: 'optional' },
          { normalizedName: '참깨', ingredientType: 'garnish' }
        ]
      }]
    });

    expect(recommendations[0]).toMatchObject({
      matchedCount: 1, totalRequiredIngredients: 1, matchedCore: ['두부'],
      matchedIngredients: ['두부', '대파', '참깨'], canMakeNow: true
    });
  });

  it('does not promise readiness with an unclassified missing item or no defined main ingredients', async () => {
    const recommendations = await recommendRecipes([{ name: '두부' }, { name: '대파' }], {
      prismaClient: {},
      vectorSearch: async () => [],
      loadRecentRecipes: async () => [
        { id: 'unclassified', name: '분류 확인 메뉴', ingredients: [
          { normalizedName: '두부', ingredientType: 'main' },
          { normalizedName: '새싹채소', ingredientType: 'unknown' }
        ] },
        { id: 'no-main', name: '핵심 재료 누락 메뉴', ingredients: [
          { normalizedName: '대파', ingredientType: 'garnish' }
        ] }
      ]
    });

    expect(recommendations.find((recipe) => recipe.id === 'unclassified')).toMatchObject({
      canMakeNow: false, missingUnknownIngredients: ['새싹채소']
    });
    expect(recommendations.find((recipe) => recipe.id === 'no-main')).toMatchObject({
      canMakeNow: false, matchedCount: 0, totalRequiredIngredients: 0, hasKnownRequirements: false
    });
  });

  it('counts owned pantry items when scoring database recipes', async () => {
    const prismaClient = {
      ingredientAlias: {
        findMany: vi.fn(async () => [])
      }
    };
    const recentRecipes = [
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
    ];
    const recommendations = await recommendRecipes([{ name: '밥' }, { name: '계란' }], {
      pantryItems: ['간장'],
      prismaClient,
      vectorSearch: async () => [],
      loadRecentRecipes: async () => recentRecipes
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
      }
    };
    const recentRecipes = [
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
    ];
    const recommendations = await recommendRecipes([{ name: '밥' }, { name: '계란' }], {
      prismaClient,
      vectorSearch: async () => [],
      loadRecentRecipes: async () => recentRecipes
    });

    expect(recommendations[0]).toMatchObject({
      recipeId: 'recipe-no-aliases',
      canMakeNow: true
    });
  });

  it('falls back to recent production recipes when vector retrieval fails', async () => {
    const prismaClient = {};
    const loadRecentRecipes = vi.fn(async () => [
      {
        id: 'fallback-recipe',
        name: '감자볶음',
        category: '반찬',
        cookingMethod: '볶기',
        rawIngredientsText: '감자',
        ingredients: [{ rawName: '감자', normalizedName: '감자', ingredientType: 'main', section: 'main' }]
      }
    ]);

    const recommendations = await recommendRecipes([{ name: '감자' }], {
      prismaClient,
      vectorSearch: async () => {
        throw new Error('vector unavailable');
      },
      loadRecentRecipes
    });

    expect(loadRecentRecipes).toHaveBeenCalledWith(prismaClient, 100);
    expect(recommendations[0]).toMatchObject({
      recipeId: 'fallback-recipe',
      vectorScore: 0,
      _recommendationSource: 'rule',
      canMakeNow: true
    });
  });
});
