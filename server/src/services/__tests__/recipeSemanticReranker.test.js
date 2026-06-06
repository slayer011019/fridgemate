import { describe, expect, it } from 'vitest';
import { scoreSemanticRecipeCandidate } from '../recipeSemanticReranker.js';

describe('recipeSemanticReranker', () => {
  it('does not let high vector similarity dominate poor ingredient overlap', () => {
    const result = scoreSemanticRecipeCandidate({
      vectorSimilarity: 0.98,
      availableIngredientNames: ['rice'],
      recipeIngredientNames: ['beef', 'onion', 'pepper', 'noodles']
    });

    expect(result.ownedIngredientRatio).toBe(0);
    expect(result.missingIngredientPenalty).toBeGreaterThan(0);
    expect(result.finalScore).toBeLessThan(0.35);
  });

  it('adds an expiring ingredient bonus for matched urgent ingredients', () => {
    const result = scoreSemanticRecipeCandidate({
      vectorSimilarity: 0.5,
      availableIngredientNames: ['kimchi', 'rice'],
      expiringIngredientNames: ['kimchi'],
      recipeIngredientNames: ['kimchi', 'rice', 'egg']
    });

    expect(result.expiringMatchedIngredients).toEqual(['kimchi']);
    expect(result.expiringIngredientBonus).toBe(0.05);
    expect(result.reason).toContain('kimchi');
  });

  it('penalizes missing ingredients and clamps output', () => {
    const result = scoreSemanticRecipeCandidate({
      vectorSimilarity: 2,
      existingRecommendationScore: 2,
      availableIngredientNames: ['kimchi'],
      recipeIngredientNames: ['kimchi', 'rice', 'egg', 'green onion', 'sesame oil']
    });

    expect(result.vectorSimilarity).toBe(1);
    expect(result.existingRecommendationScore).toBe(1);
    expect(result.missingIngredients).toEqual(['rice', 'egg', 'green onion', 'sesame oil']);
    expect(result.finalScore).toBeGreaterThanOrEqual(0);
    expect(result.finalScore).toBeLessThanOrEqual(1);
  });
});
