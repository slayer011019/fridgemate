import { describe, expect, it } from 'vitest';
import { getDuplicateIngredientCleanupPlan } from '../ingredientSelectors.js';

function createIngredient(id, overrides = {}) {
  return {
    id,
    clientId: id,
    name: 'Milk',
    category: 'dairy',
    storageType: 'fridge',
    quantity: '1',
    purchaseDate: '',
    expiryDate: '',
    consumed: false,
    ...overrides
  };
}

describe('ingredientSelectors', () => {
  it('keeps the latest purchase date when building a duplicate cleanup plan', () => {
    const plan = getDuplicateIngredientCleanupPlan([
      createIngredient('old', { purchaseDate: '2026-04-01' }),
      createIngredient('latest', { purchaseDate: '2026-04-10' }),
      createIngredient('middle', { purchaseDate: '2026-04-05' })
    ]);

    expect(plan.duplicateGroupCount).toBe(1);
    expect(plan.removeCount).toBe(2);
    expect(plan.groups[0].keep.id).toBe('latest');
    expect(plan.removeIds).toEqual(['middle', 'old']);
  });

  it('does not group consumed items or different storage locations', () => {
    const plan = getDuplicateIngredientCleanupPlan([
      createIngredient('fridge-a', { purchaseDate: '2026-04-01' }),
      createIngredient('fridge-b', { purchaseDate: '2026-04-02' }),
      createIngredient('freezer-a', { storageType: 'freezer', purchaseDate: '2026-04-03' }),
      createIngredient('consumed-a', { consumed: true, purchaseDate: '2026-04-04' })
    ]);

    expect(plan.duplicateGroupCount).toBe(1);
    expect(plan.removeIds).toEqual(['fridge-a']);
  });
});
