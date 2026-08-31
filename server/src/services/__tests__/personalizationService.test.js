import { describe, expect, it } from 'vitest';
import {
  normalizePantryOwnershipInput,
  normalizeUserPreferenceInput
} from '../personalizationService.js';

describe('personalization validation', () => {
  it('accepts bounded pantry ownership and rejects duplicates', () => {
    expect(normalizePantryOwnershipInput({ items: [{ stapleId: 'salt', status: 'owned' }] })).toEqual([
      { stapleId: 'salt', status: 'owned' }
    ]);
    expect(() => normalizePantryOwnershipInput({
      items: [{ stapleId: 'salt', status: 'owned' }, { stapleId: 'salt', status: 'missing' }]
    })).toThrow();
  });

  it('normalizes ingredient preferences and rejects unknown fields', () => {
    expect(normalizeUserPreferenceInput({
      preferredIngredients: [' 계란 ', '달걀'],
      dislikedIngredients: ['고수'],
      spiceLevel: 'mild',
      cookingTimePreference: 'quick'
    })).toMatchObject({
      preferredIngredients: ['계란'],
      dislikedIngredients: ['고수'],
      spiceLevel: 'mild',
      cookingTimePreference: 'quick'
    });
    expect(() => normalizeUserPreferenceInput({ admin: true })).toThrow();
  });
});
