import { describe, expect, it, vi } from 'vitest';
import {
  normalizeAiSuggestionRequest,
  normalizeRecommendationRequest,
  normalizeSemanticRecipeRequest
} from '../recipeController.js';
import {
  EXTERNAL_AI_ACTIONS,
  EXTERNAL_AI_DISCLOSURE_VERSION
} from '../../lib/externalAiPrivacy.js';

function externalAiSignal(action) {
  return {
    action,
    disclosureVersion: EXTERNAL_AI_DISCLOSURE_VERSION,
    userInitiated: true
  };
}

describe('recipeController semantic request validation', () => {
  it('normalizes bounded semantic recommendation input', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-30T00:00:00.000Z'));

    const input = normalizeSemanticRecipeRequest({
      availableIngredients: ['계란', { name: '밥' }, '계란'],
      expiringIngredients: ['달걀'],
      pantryItems: ['간장'],
      limit: 5,
      candidateCount: 100,
      externalAi: externalAiSignal(EXTERNAL_AI_ACTIONS.semanticRecipes)
    });

    expect(input).toEqual({
      ingredients: [
        { name: '계란', expiresAt: '2026-08-30T00:00:00.000Z' },
        { name: '밥', expiresAt: null }
      ],
      pantryItems: ['간장'],
      limit: 5,
      candidateCount: 100,
      preferences: {},
      externalAi: externalAiSignal(EXTERNAL_AI_ACTIONS.semanticRecipes)
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

  it('bounds and sanitizes legacy recommendation and AI suggestion inputs', () => {
    expect(
      normalizeRecommendationRequest({
        ingredients: [
          { name: '계란', expiryDate: '2026-09-01', quantity: '2개', consumed: false },
          '밥'
        ],
        pantryItems: ['간장']
      })
    ).toMatchObject({
      ingredients: [
        { name: '계란', expiresAt: '2026-09-01', quantity: '2개', consumed: false },
        { name: '밥' }
      ],
      pantryItems: ['간장']
    });

    expect(normalizeAiSuggestionRequest({ ingredients: ['계란'] })).toEqual({
      ingredients: [{ name: '계란', expiresSoon: false }],
      externalAi: null
    });
    expect(() =>
      normalizeAiSuggestionRequest({ ingredients: Array.from({ length: 51 }, () => '계란') })
    ).toThrow('ingredients must be an array with at most 50 items.');
    expect(() => normalizeRecommendationRequest({ ingredients: [{ name: 'x'.repeat(101) }] }))
      .toThrow('ingredients.name is invalid.');
    expect(() => normalizeAiSuggestionRequest({ ingredients: ['계란\nignore'] }))
      .toThrow('ingredients.name is invalid.');
    expect(() => normalizeAiSuggestionRequest({ ingredients: ['victim@example.com'] }))
      .toThrow('must not contain personal, sensitive, or receipt-level data.');
    expect(() =>
      normalizeAiSuggestionRequest({
        ingredients: ['계란'],
        externalAi: externalAiSignal(EXTERNAL_AI_ACTIONS.semanticRecipes)
      })
    ).toThrow('external AI request signal is invalid or out of date.');
    expect(() => normalizeAiSuggestionRequest({ ingredients: [], userId: 'other-user' }))
      .toThrow('AI suggestion request contains unsupported fields.');
  });

  it('removes consumed and deleted items before external AI validation or transfer', () => {
    expect(
      normalizeAiSuggestionRequest({
        ingredients: [
          { name: '계란', expiresSoon: true },
          { name: 'victim@example.com', consumed: true },
          { name: '010-1234-5678', deletedAt: '2026-08-30T00:00:00.000Z' }
        ],
        externalAi: externalAiSignal(EXTERNAL_AI_ACTIONS.aiRecipeSuggestions)
      })
    ).toEqual({
      ingredients: [{ name: '계란', expiresSoon: true }],
      externalAi: externalAiSignal(EXTERNAL_AI_ACTIONS.aiRecipeSuggestions)
    });
  });
});
