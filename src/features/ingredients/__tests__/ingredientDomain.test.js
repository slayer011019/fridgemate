import { describe, expect, it } from 'vitest';
import {
  getOwnedPantryItems,
  normalizeIngredientName,
  resolvePantryItems,
  uniqueNormalizedIngredients
} from '../ingredientDomain.js';

describe('ingredientDomain', () => {
  it('normalizes aliases and pantry staples through one shared map', () => {
    expect(normalizeIngredientName('달걀')).toBe('계란');
    expect(normalizeIngredientName('(파).')).toBe('대파');
    expect(normalizeIngredientName('soy sauce')).toBe('간장');
    expect(normalizeIngredientName('stock')).toBe('치킨스톡');
  });

  it('deduplicates normalized ingredient lists', () => {
    expect(uniqueNormalizedIngredients(['계란', '달걀', '  계란  ', '파'])).toEqual(['계란', '대파']);
  });

  it('resolves owned pantry items from ownership state', () => {
    const pantryOwnership = {
      salt: 'owned',
      'soy-sauce': 'missing',
      'cooking-oil': 'owned'
    };

    expect(getOwnedPantryItems(pantryOwnership)).toEqual(['소금', '식용유']);
    expect(resolvePantryItems({ pantryOwnership })).toEqual(['소금', '식용유']);
    expect(resolvePantryItems({ pantryItems: ['간장'] })).toEqual(['간장']);
  });
});
