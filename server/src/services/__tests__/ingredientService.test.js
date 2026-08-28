import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  ingredient: {
    create: vi.fn(),
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn()
  },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(async (operation) => operation(prismaMock))
};

vi.mock('../../db/prisma.js', () => ({
  prisma: prismaMock
}));

function createIngredient(id, overrides = {}) {
  return {
    id,
    clientId: id,
    name: `ingredient-${id}`,
    category: 'vegetable',
    storageType: 'fridge',
    quantity: '1',
    purchaseDate: '2026-05-01',
    expiryDate: '2026-05-08',
    memo: '',
    consumed: false,
    updatedAt: '2026-08-26T10:00:00.000Z',
    deletedAt: null,
    ...overrides
  };
}

describe('ingredientService', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-26T12:00:00.000Z'));
    vi.clearAllMocks();
    prismaMock.$queryRaw.mockResolvedValue([{ set_config: 'user-1' }]);
    prismaMock.ingredient.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.ingredient.findFirst.mockResolvedValue(null);
    prismaMock.ingredient.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.ingredient.upsert.mockResolvedValue({});
    prismaMock.ingredient.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('syncs record-level changes by userId and clientId without deleting omitted rows', async () => {
    const { syncIngredientChanges } = await import('../ingredientService.js');

    const result = await syncIngredientChanges('user-1', [createIngredient('local-1')]);

    expect(prismaMock.ingredient.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.ingredient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ clientId: 'local-1', userId: 'user-1' })
    });
    expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function));
    expect(prismaMock.$queryRaw).toHaveBeenCalledOnce();
    expect(result).toEqual({ items: [], appliedCount: 1 });
  });

  it('uses id as clientId for older local payloads', async () => {
    const { syncIngredientChanges } = await import('../ingredientService.js');
    const { clientId, ...legacyIngredient } = createIngredient('legacy-local-1');

    await syncIngredientChanges('user-1', [legacyIngredient]);

    expect(prismaMock.ingredient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ clientId: 'legacy-local-1', userId: 'user-1' })
    });
  });

  it('keeps a newer server record instead of applying an older device change', async () => {
    prismaMock.ingredient.findFirst.mockResolvedValue(
      createIngredient('server-id', {
        clientId: 'shared',
        userId: 'user-1',
        updatedAt: new Date('2026-08-26T12:00:00.000Z')
      })
    );
    const { syncIngredientChanges } = await import('../ingredientService.js');

    const result = await syncIngredientChanges('user-1', [
      createIngredient('local-id', { clientId: 'shared', updatedAt: '2026-08-26T11:00:00.000Z' })
    ]);

    expect(prismaMock.ingredient.updateMany).not.toHaveBeenCalled();
    expect(result.appliedCount).toBe(0);
  });

  it('uploads a deletion tombstone without physically deleting the server row', async () => {
    const { syncIngredientChanges } = await import('../ingredientService.js');
    await syncIngredientChanges('user-1', [
      createIngredient('deleted', {
        deletedAt: '2026-08-26T11:00:00.000Z',
        updatedAt: '2026-08-26T11:00:00.000Z'
      })
    ]);

    expect(prismaMock.ingredient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ deletedAt: '2026-08-26T11:00:00.000Z', userId: 'user-1' })
    });
    expect(prismaMock.ingredient.deleteMany).not.toHaveBeenCalled();
  });

  it('scopes sync lookups, writes, and returned state to the authenticated user', async () => {
    const { syncIngredientChanges } = await import('../ingredientService.js');
    await syncIngredientChanges('user-a', [createIngredient('shared-client')]);

    expect(prismaMock.ingredient.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-a', clientId: 'shared-client' }
    });
    expect(prismaMock.ingredient.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-a' },
      orderBy: { updatedAt: 'desc' }
    });
    expect(prismaMock.ingredient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ clientId: 'shared-client', userId: 'user-a' })
    });
  });

  it('ignores a userId supplied by the client payload', async () => {
    const { syncIngredientChanges } = await import('../ingredientService.js');
    await syncIngredientChanges('user-a', [createIngredient('owned', { userId: 'user-b' })]);

    expect(prismaMock.ingredient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ clientId: 'owned', userId: 'user-a' })
    });
  });

  it('keeps the existing server value when timestamps are equal', async () => {
    prismaMock.ingredient.findFirst.mockResolvedValue(
      createIngredient('server-id', {
        clientId: 'shared',
        name: 'server-value',
        userId: 'user-1',
        updatedAt: new Date('2026-08-26T10:00:00.000Z')
      })
    );
    const { syncIngredientChanges } = await import('../ingredientService.js');
    const result = await syncIngredientChanges('user-1', [
      createIngredient('local-id', {
        clientId: 'shared',
        name: 'different-local-value',
        updatedAt: '2026-08-26T10:00:00.000Z'
      })
    ]);

    expect(prismaMock.ingredient.updateMany).not.toHaveBeenCalled();
    expect(result.appliedCount).toBe(0);
  });

  it('rejects timestamps too far in the future before opening a database transaction', async () => {
    const { syncIngredientChanges } = await import('../ingredientService.js');

    await expect(
      syncIngredientChanges('user-1', [createIngredient('future', { updatedAt: '2099-01-01T00:00:00.000Z' })])
    ).rejects.toMatchObject({ status: 400, message: 'Ingredient updatedAt is too far in the future.' });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an older client payload without updatedAt before any write', async () => {
    const { updatedAt: _updatedAt, ...legacyPayload } = createIngredient('legacy-without-time');
    const { syncIngredientChanges } = await import('../ingredientService.js');

    await expect(syncIngredientChanges('user-1', [legacyPayload])).rejects.toMatchObject({
      status: 400,
      message: 'Ingredient updatedAt is required for sync.'
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.ingredient.create).not.toHaveBeenCalled();
    expect(prismaMock.ingredient.updateMany).not.toHaveBeenCalled();
  });

  it('fails before writing when the deployed schema does not have the sync column', async () => {
    const missingColumnError = Object.assign(new Error('Missing column.'), { code: 'P2022' });
    prismaMock.ingredient.findFirst.mockRejectedValue(missingColumnError);
    const { syncIngredientChanges } = await import('../ingredientService.js');

    await expect(syncIngredientChanges('user-1', [createIngredient('migration-required')])).rejects.toBe(
      missingColumnError
    );
    expect(prismaMock.ingredient.create).not.toHaveBeenCalled();
    expect(prismaMock.ingredient.updateMany).not.toHaveBeenCalled();
  });

  it('updates an existing record only when the incoming timestamp is at least as new', async () => {
    prismaMock.ingredient.findFirst.mockResolvedValue(
      createIngredient('server-id', {
        clientId: 'shared',
        userId: 'user-1',
        updatedAt: new Date('2026-08-26T10:00:00.000Z')
      })
    );
    const { syncIngredientChanges } = await import('../ingredientService.js');

    await syncIngredientChanges('user-1', [
      createIngredient('local-id', { clientId: 'shared', updatedAt: '2026-08-26T11:00:00.000Z' })
    ]);

    expect(prismaMock.ingredient.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-1',
          clientId: 'shared',
          updatedAt: { lt: new Date('2026-08-26T11:00:00.000Z') }
        }
      })
    );
  });

  it('updates an ingredient with the id and authenticated user in one mutation condition', async () => {
    const existingIngredient = createIngredient('ingredient-1', { userId: 'user-1' });
    const updatedIngredient = {
      ...existingIngredient,
      name: 'updated ingredient'
    };
    prismaMock.ingredient.findFirst
      .mockResolvedValueOnce(existingIngredient)
      .mockResolvedValueOnce(updatedIngredient);
    prismaMock.ingredient.updateMany.mockResolvedValue({ count: 1 });
    const { updateIngredientById } = await import('../ingredientService.js');

    await expect(updateIngredientById('user-1', 'ingredient-1', { name: 'updated ingredient' })).resolves.toEqual(
      updatedIngredient
    );

    expect(prismaMock.ingredient.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'ingredient-1',
        userId: 'user-1'
      },
      data: expect.objectContaining({
        name: 'updated ingredient'
      })
    });
    expect(prismaMock.ingredient.updateMany.mock.calls[0][0].data).not.toHaveProperty('id');
    expect(prismaMock.ingredient.updateMany.mock.calls[0][0].data).not.toHaveProperty('userId');
  });

  it('returns not found when an owned ingredient disappears before update', async () => {
    prismaMock.ingredient.findFirst.mockResolvedValue(createIngredient('ingredient-1', { userId: 'user-1' }));
    prismaMock.ingredient.updateMany.mockResolvedValue({ count: 0 });
    const { updateIngredientById } = await import('../ingredientService.js');

    await expect(updateIngredientById('user-1', 'ingredient-1', { name: 'updated ingredient' })).rejects.toMatchObject({
      status: 404,
      message: 'Ingredient not found.'
    });
  });

  it('soft deletes only when both ingredient id and authenticated user match', async () => {
    prismaMock.ingredient.updateMany.mockResolvedValue({ count: 1 });
    const { deleteIngredientById } = await import('../ingredientService.js');

    await expect(deleteIngredientById('user-1', 'ingredient-1')).resolves.toBeUndefined();
    expect(prismaMock.ingredient.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'ingredient-1',
        userId: 'user-1',
        deletedAt: null
      },
      data: {
        deletedAt: expect.any(Date),
        updatedAt: expect.any(Date)
      }
    });
  });

  it('does not reveal whether another user owns a requested ingredient id', async () => {
    prismaMock.ingredient.updateMany.mockResolvedValue({ count: 0 });
    const { deleteIngredientById } = await import('../ingredientService.js');

    await expect(deleteIngredientById('user-1', 'other-user-ingredient')).rejects.toMatchObject({
      status: 404,
      message: 'Ingredient not found.'
    });
  });
});
