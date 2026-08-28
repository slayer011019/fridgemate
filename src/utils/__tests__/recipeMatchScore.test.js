import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseRecipeIngredients } from '../../features/recipes/recipeImport.js';
import { getRecipeMatchScore } from '../recommendations.js';

describe('getRecipeMatchScore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 1, 12, 0, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('scores recipes by matched main ingredients and separates missing seasonings', () => {
    const recipeIngredients = parseRecipeIngredients(
      '연두부 75g(3/4모), 달걀 30g(1/2개), 물 300ml(1½컵), ●양념장 : 참기름 5ml(1작은술), 참깨 약간'
    );
    const result = getRecipeMatchScore(
      [
        { name: '연두부', expiryDate: '2026-05-02' },
        { name: '계란', expiryDate: '2026-02-01' }
      ],
      recipeIngredients,
      { recipeId: 'soft-tofu-steam' }
    );

    expect(result).toMatchObject({
      recipeId: 'soft-tofu-steam',
      matchedIngredients: ['두부', '계란'],
      missingIngredients: [],
      missingSeasonings: ['참기름', '참깨'],
      expiringMatchedIngredients: ['두부']
    });
    expect(result.score).toBeGreaterThan(0.7);
  });

  it('does not let seasoning, optional, garnish, liquid, or unknown items inflate core missing count', () => {
    const result = getRecipeMatchScore(
      [{ name: '두부' }],
      [
        { normalizedName: '두부', ingredientType: 'main' },
        { normalizedName: '간장', ingredientType: 'seasoning' },
        { normalizedName: '쪽파', ingredientType: 'garnish' },
        { normalizedName: '치즈', ingredientType: 'optional' },
        { normalizedName: '물', ingredientType: 'liquid' },
        { normalizedName: '새싹채소', ingredientType: 'unknown' }
      ],
      { recipeId: 'classified-recipe' }
    );

    expect(result.missingIngredients).toEqual([]);
    expect(result.missingSeasonings).toEqual(['진간장']);
    expect(result.missingUnknown).toEqual(['새싹채소']);
  });

  it('keeps a missing main ingredient as a core requirement', () => {
    const result = getRecipeMatchScore(
      [{ name: '두부' }],
      [
        { normalizedName: '두부', ingredientType: 'main' },
        { normalizedName: '돼지고기', ingredientType: 'main' }
      ],
      { recipeId: 'missing-main' }
    );

    expect(result.missingIngredients).toEqual(['돼지고기']);
  });
});
