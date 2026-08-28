import { beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMocks = vi.hoisted(() => ({
  listIngredientSyncState: vi.fn(),
  syncIngredientChanges: vi.fn()
}));

vi.mock('../../services/ingredientService.js', () => ({
  createIngredient: vi.fn(),
  createIngredientsBulk: vi.fn(),
  deleteIngredientById: vi.fn(),
  getIngredientById: vi.fn(),
  listIngredientSyncState: serviceMocks.listIngredientSyncState,
  listIngredients: vi.fn(),
  syncIngredientChanges: serviceMocks.syncIngredientChanges,
  updateIngredientById: vi.fn()
}));

describe('ingredientController sync handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the authenticated userId and ignores a payload userId', async () => {
    const changes = [{ clientId: 'shared', userId: 'user-b' }];
    const result = { items: [], appliedCount: 1 };
    serviceMocks.syncIngredientChanges.mockResolvedValue(result);
    const response = { json: vi.fn() };
    const next = vi.fn();
    const { syncIngredientsHandler } = await import('../ingredientController.js');

    await syncIngredientsHandler(
      { auth: { userId: 'user-a' }, body: { changes, userId: 'user-b' } },
      response,
      next
    );

    expect(serviceMocks.syncIngredientChanges).toHaveBeenCalledWith('user-a', changes);
    expect(response.json).toHaveBeenCalledWith(result);
    expect(next).not.toHaveBeenCalled();
  });

  it('scopes complete sync-state reads to the authenticated user', async () => {
    serviceMocks.listIngredientSyncState.mockResolvedValue([]);
    const response = { json: vi.fn() };
    const next = vi.fn();
    const { getIngredientSyncStateHandler } = await import('../ingredientController.js');

    await getIngredientSyncStateHandler({ auth: { userId: 'user-a' } }, response, next);

    expect(serviceMocks.listIngredientSyncState).toHaveBeenCalledWith('user-a');
    expect(response.json).toHaveBeenCalledWith({ items: [] });
    expect(next).not.toHaveBeenCalled();
  });
});
