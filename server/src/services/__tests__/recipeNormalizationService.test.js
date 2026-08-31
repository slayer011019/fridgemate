import { describe, expect, it } from 'vitest';
import { parseRecipeIngredients } from '../../../../src/features/recipes/recipeImport.js';
import { normalizeIngredientsWithLLM } from '../recipeNormalizationService.js';

describe('recipeNormalizationService', () => {
  it('preserves rawName and applies LLM normalizedName results', async () => {
    const rawIngredients = parseRecipeIngredients('칵테일새우 20g(5마리), 저염간장 3g(1작은술)');
    const normalized = await normalizeIngredientsWithLLM(rawIngredients, {
      llmClient: async () => [
        { rawName: '칵테일새우', normalizedName: '새우', ingredientType: 'main', confidence: 0.91 },
        { rawName: '저염간장', normalizedName: '간장', ingredientType: 'seasoning', confidence: 0.88 }
      ]
    });

    expect(normalized[0]).toMatchObject({
      rawName: '칵테일새우',
      normalizedName: '새우',
      ingredientType: 'main',
      confidence: 0.91,
      reviewNeeded: false
    });
    expect(normalized[1]).toMatchObject({
      rawName: '저염간장',
      normalizedName: '간장',
      ingredientType: 'seasoning'
    });
  });

  it('falls back to rule-based normalization when LLM normalization fails', async () => {
    const rawIngredients = parseRecipeIngredients('다진 마늘 5g, 달걀 30g(1/2개)');
    const normalized = await normalizeIngredientsWithLLM(rawIngredients, {
      llmClient: async () => {
        throw new Error('LLM unavailable');
      }
    });

    expect(normalized.map((ingredient) => ingredient.normalizedName)).toEqual(['마늘', '계란']);
    expect(normalized.every((ingredient) => typeof ingredient.reviewNeeded === 'boolean')).toBe(true);
  });

  it('falls back to rules when an operator normalization request times out', async () => {
    const rawIngredients = parseRecipeIngredients('다진 마늘 5g');
    const normalized = await normalizeIngredientsWithLLM(rawIngredients, {
      apiKey: 'test-key',
      timeoutMs: 1,
      fetchImpl: (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
        })
    });

    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toMatchObject({ normalizedName: '마늘' });
  });
});
