import { beforeEach, describe, expect, it, vi } from 'vitest';

const { database, scopeMock } = vi.hoisted(() => ({
  database: {
    menuDecision: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn()
    },
    recipe: { findUnique: vi.fn() }
  },
  scopeMock: vi.fn()
}));

vi.mock('../../db/tenantScope.js', () => ({
  withUserDatabaseScope: (userId, callback) => {
    scopeMock(userId);
    return callback(database);
  }
}));

import {
  completeMenuDecision,
  normalizeDecisionDate,
  normalizeMenuSelection,
  selectMenuDecision
} from '../menuDecisionService.js';

const selection = {
  clientId: 'client-1',
  recipeKey: 'catalog:11111111-1111-4111-8111-111111111111',
  recipeName: '김치볶음밥',
  recommendationSource: 'hybrid',
  selectedAt: '2026-08-30T01:00:00.000Z'
};

describe('menuDecisionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.recipe.findUnique.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111' });
    database.menuDecision.upsert.mockImplementation(({ create }) => Promise.resolve({
      ...create,
      id: 'decision-1',
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  });

  it('validates real calendar dates and namespaced recipe keys', () => {
    const now = new Date('2026-08-30T12:00:00.000Z').getTime();
    expect(normalizeDecisionDate('2026-08-30', now)).toBeInstanceOf(Date);
    expect(() => normalizeDecisionDate('2026-02-30', now)).toThrow('date must be a real calendar date.');
    expect(() => normalizeDecisionDate('2025-01-01', now)).toThrow(
      'date is outside the supported sync window.'
    );
    expect(normalizeMenuSelection(selection)).toMatchObject({
      catalogRecipeId: '11111111-1111-4111-8111-111111111111'
    });
    expect(() => normalizeMenuSelection({ ...selection, recipeKey: 'recipe-1' })).toThrow();
    expect(() => normalizeMenuSelection({ ...selection, recipeName: '김치\n볶음밥' })).toThrow();
  });

  it('scopes an idempotent daily upsert to the authenticated user and resets completion', async () => {
    await selectMenuDecision('user-a', '2026-08-30', selection);
    await selectMenuDecision('user-a', '2026-08-30', selection);

    expect(scopeMock).toHaveBeenNthCalledWith(1, 'user-a');
    expect(database.menuDecision.upsert).toHaveBeenCalledTimes(2);
    expect(database.menuDecision.upsert).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { userId_decisionDate: { userId: 'user-a', decisionDate: expect.any(Date) } },
      update: expect.objectContaining({ status: 'selected', completedAt: null })
    }));
  });

  it('rejects a stale device completion and never touches another user scope', async () => {
    database.menuDecision.findUnique.mockResolvedValue({ id: 'decision-1', clientId: 'newer-client' });

    await expect(completeMenuDecision('user-a', '2026-08-30', {
      clientId: 'stale-client',
      completedAt: '2026-08-30T02:00:00.000Z'
    })).rejects.toMatchObject({ status: 409 });
    expect(scopeMock).toHaveBeenCalledWith('user-a');
    expect(scopeMock).not.toHaveBeenCalledWith('user-b');
    expect(database.menuDecision.update).not.toHaveBeenCalled();
  });
});
