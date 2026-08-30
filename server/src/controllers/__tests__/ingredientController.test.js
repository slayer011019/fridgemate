import { beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMocks = vi.hoisted(() => ({
  createIngredient: vi.fn(),
  createIngredientsBulk: vi.fn(),
  listIngredientSyncState: vi.fn(),
  syncIngredientChanges: vi.fn()
}));

vi.mock('../../services/ingredientService.js', () => ({
  createIngredient: serviceMocks.createIngredient,
  createIngredientsBulk: serviceMocks.createIngredientsBulk,
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

  it('rejects a null sync body before calling the service', async () => {
    const response = { json: vi.fn() };
    const next = vi.fn();
    const { syncIngredientsHandler } = await import('../ingredientController.js');

    await syncIngredientsHandler({ auth: { userId: 'user-a' }, body: null }, response, next);

    expect(serviceMocks.syncIngredientChanges).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 400, message: 'Ingredient sync request must be an object.' })
    );
  });

  it('passes the legacy items sync array through unchanged', async () => {
    const items = [{ clientId: 'legacy-item' }];
    serviceMocks.syncIngredientChanges.mockResolvedValue({ items: [], appliedCount: 0 });
    const response = { json: vi.fn() };
    const next = vi.fn();
    const { syncIngredientsHandler } = await import('../ingredientController.js');

    await syncIngredientsHandler({ auth: { userId: 'user-a' }, body: { items } }, response, next);

    expect(serviceMocks.syncIngredientChanges).toHaveBeenCalledWith('user-a', items);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an array create body before calling the service', async () => {
    const response = { status: vi.fn(() => response), json: vi.fn() };
    const next = vi.fn();
    const { createIngredientHandler } = await import('../ingredientController.js');

    await createIngredientHandler({ auth: { userId: 'user-a' }, body: [] }, response, next);

    expect(serviceMocks.createIngredient).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 400, message: 'Ingredient request must be an object.' })
    );
  });
});
