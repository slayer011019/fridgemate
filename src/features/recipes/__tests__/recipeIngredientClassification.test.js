import { describe, expect, it } from 'vitest';
import {
  classifyRecipeIngredient,
  dedupeRecipeIngredients,
  normalizeRecipeIngredientName
} from '../recipeIngredientClassification.js';

describe('recipe ingredient classification', () => {
  it('prefers an explicit valid category', () => {
    expect(classifyRecipeIngredient({ category: 'main', rawName: '소금' })).toEqual({
      type: 'main',
      confidence: 0.99,
      reason: 'explicit-category'
    });
  });

  it('uses section and raw markers before dictionaries', () => {
    expect(classifyRecipeIngredient({ section: '양념장', rawName: '양파' }).type).toBe('seasoning');
    expect(classifyRecipeIngredient({ section: '고명', rawName: '대파' }).type).toBe('garnish');
    expect(classifyRecipeIngredient({ rawText: '*선택: 황설탕 1g', rawName: '황설탕' }).type).toBe('optional');
  });

  it('classifies normalized seasoning and liquid names', () => {
    expect(classifyRecipeIngredient({ normalizedName: '참기름' })).toMatchObject({
      type: 'seasoning',
      reason: 'normalized-name-dictionary'
    });
    expect(classifyRecipeIngredient({ normalizedName: '멸치육수' })).toMatchObject({
      type: 'liquid',
      reason: 'normalized-name-dictionary'
    });
  });

  it('uses recipe-title context for a likely main ingredient', () => {
    expect(classifyRecipeIngredient({ normalizedName: '단호박', recipeName: '단호박약식' })).toMatchObject({
      type: 'main',
      reason: 'recipe-title-match'
    });
  });

  it('keeps unsupported ingredients unknown', () => {
    expect(classifyRecipeIngredient({ normalizedName: '새싹채소' })).toEqual({
      type: 'unknown',
      confidence: 0.35,
      reason: 'insufficient-evidence'
    });
  });

  it('uses a parsed substantial quantity as conservative main evidence', () => {
    expect(classifyRecipeIngredient({ normalizedName: '새싹채소', amount: 30, unit: 'g' })).toEqual({
      type: 'main',
      confidence: 0.72,
      reason: 'substantial-quantity'
    });
  });

  it('cleans section prefixes, amounts, aliases, and duplicate names', () => {
    expect(normalizeRecipeIngredientName('•필수재료 : 달걀 1개')).toBe('계란');
    const deduped = dedupeRecipeIngredients([
      { normalizedName: '달걀', ingredientType: 'unknown', classificationConfidence: 0.35 },
      { normalizedName: '계란', ingredientType: 'main', classificationConfidence: 0.9 }
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]).toMatchObject({ normalizedName: '계란', ingredientType: 'main' });
  });
});
