import { describe, expect, it, vi } from 'vitest';
import { normalizeSemanticRecipeRequest } from '../recipeController.js';

describe('recipeController semantic request validation', () => {
  it('normalizes bounded semantic recommendation input', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-30T00:00:00.000Z'));

    const input = normalizeSemanticRecipeRequest({
      availableIngredients: ['계란', { name: '밥' }, '계란'],
      expiringIngredients: ['달걀'],
      pantryItems: ['간장'],
      limit: 5,
      candidateCount: 100
    });

    expect(input).toEqual({
      ingredients: [
        { name: '계란', expiresAt: '2026-08-30T00:00:00.000Z' },
        { name: '밥', expiresAt: null }
      ],
      pantryItems: ['간장'],
      limit: 5,
      candidateCount: 100
    });

    vi.useRealTimers();
  });

  it('rejects empty, oversized, and unsupported input', () => {
    expect(() => normalizeSemanticRecipeRequest({ availableIngredients: [] })).toThrow(
      'availableIngredients must include at least one ingredient.'
    );
    expect(() =>
      normalizeSemanticRecipeRequest({ availableIngredients: ['계란'], limit: 21 })
    ).toThrow('limit must be an integer between 1 and 20.');
    expect(() =>
      normalizeSemanticRecipeRequest({ availableIngredients: ['계란'], candidateCount: 251 })
    ).toThrow('candidateCount must be an integer between 10 and 250.');
    expect(() =>
      normalizeSemanticRecipeRequest({ availableIngredients: ['계란'], userId: 'other-user' })
    ).toThrow('Semantic recipe request contains unsupported fields.');
  });
});
