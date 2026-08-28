import { describe, expect, it, vi } from 'vitest';
import { getProductionRecipesByIds, getRecentProductionRecipes } from '../recipeCatalogService.js';

const RECIPE_A = '11111111-1111-4111-8111-111111111111';
const RECIPE_B = '22222222-2222-4222-8222-222222222222';

function createPrismaClient() {
  return {
    $queryRawUnsafe: vi.fn(async (sql) => {
      if (sql.includes('FROM recipe_ingredients')) {
        return [
          {
            id: 'ingredient-a',
            recipe_id: RECIPE_A,
            raw_text: '달걀 1개',
            raw_name: '계란',
            normalized_name: '계란',
            canonical_name: '달걀',
            amount: '1',
            unit: '개',
            confidence: '0.9'
          }
        ];
      }

      return [
        {
          id: RECIPE_A,
          external_id: '100',
          name: '달걀밥',
          cooking_method: '비비기',
          dish_type: '밥',
          ingredients_text: '달걀, 밥',
          source: 'MFDS_COOKRCP01',
          updated_at: new Date('2026-01-01T00:00:00Z')
        },
        {
          id: RECIPE_B,
          external_id: '200',
          name: '채소밥',
          cooking_method: '비비기',
          dish_type: '밥',
          ingredients_text: '채소, 밥',
          source: 'MFDS_COOKRCP01',
          updated_at: new Date('2026-01-02T00:00:00Z')
        }
      ];
    })
  };
}

describe('recipeCatalogService', () => {
  it('loads production recipes in candidate order and maps canonical ingredients', async () => {
    const prismaClient = createPrismaClient();
    const recipes = await getProductionRecipesByIds(prismaClient, [RECIPE_B, RECIPE_A]);

    expect(recipes.map((recipe) => recipe.id)).toEqual([RECIPE_B, RECIPE_A]);
    expect(recipes[1]).toMatchObject({
      externalId: '100',
      category: '밥',
      cookingMethod: '비비기',
      rawIngredientsText: '달걀, 밥'
    });
    expect(recipes[1].ingredients[0]).toMatchObject({
      rawName: '계란',
      normalizedName: '계란',
      ingredientType: 'main',
      amountValue: 1,
      amountUnit: '개',
      confidence: 0.9
    });
  });

  it('drops invalid candidate ids instead of interpolating them into SQL', async () => {
    const prismaClient = createPrismaClient();

    await expect(getProductionRecipesByIds(prismaClient, ['not-a-uuid'])).resolves.toEqual([]);
    expect(prismaClient.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('loads recent production rows as a fallback candidate source', async () => {
    const prismaClient = createPrismaClient();
    const recipes = await getRecentProductionRecipes(prismaClient, 10);

    expect(recipes).toHaveLength(2);
    expect(prismaClient.$queryRawUnsafe.mock.calls[0][0]).toContain('ORDER BY updated_at DESC');
    expect(prismaClient.$queryRawUnsafe.mock.calls[0][0]).toContain('LIMIT 10');
  });
});
