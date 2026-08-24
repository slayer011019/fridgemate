import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  ingredient: {
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn()
  },
  $transaction: vi.fn()
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
    ...overrides
  };
}

describe('ingredientService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.ingredient.deleteMany.mockReturnValue({ operation: 'deleteMany' });
    prismaMock.ingredient.upsert.mockReturnValue({ operation: 'upsert' });
    prismaMock.ingredient.findMany.mockResolvedValue([]);
    prismaMock.$transaction.mockResolvedValue([]);
  });

  it('syncs ingredients by upserting with userId and clientId', async () => {
    const { replaceIngredientsForUser } = await import('../ingredientService.js');

    await replaceIngredientsForUser('user-1', [createIngredient('local-1')]);

    expect(prismaMock.ingredient.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        clientId: {
          notIn: ['local-1']
        }
      }
    });
    expect(prismaMock.ingredient.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_clientId: {
            userId: 'user-1',
            clientId: 'local-1'
          }
        },
        create: expect.objectContaining({
          clientId: 'local-1',
          userId: 'user-1'
        }),
        update: expect.objectContaining({
          clientId: 'local-1',
          userId: 'user-1'
        })
      })
    );
    expect(prismaMock.$transaction).toHaveBeenCalledWith([{ operation: 'deleteMany' }, { operation: 'upsert' }]);
  });

  it('uses id as clientId for older local payloads', async () => {
    const { replaceIngredientsForUser } = await import('../ingredientService.js');
    const { clientId, ...legacyIngredient } = createIngredient('legacy-local-1');

    await replaceIngredientsForUser('user-1', [legacyIngredient]);

    expect(prismaMock.ingredient.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_clientId: {
            userId: 'user-1',
            clientId: 'legacy-local-1'
          }
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

  it('deletes only when both ingredient id and authenticated user match', async () => {
    prismaMock.ingredient.deleteMany.mockResolvedValue({ count: 1 });
    const { deleteIngredientById } = await import('../ingredientService.js');

    await expect(deleteIngredientById('user-1', 'ingredient-1')).resolves.toBeUndefined();
    expect(prismaMock.ingredient.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'ingredient-1',
        userId: 'user-1'
      }
    });
  });

  it('does not reveal whether another user owns a requested ingredient id', async () => {
    prismaMock.ingredient.deleteMany.mockResolvedValue({ count: 0 });
    const { deleteIngredientById } = await import('../ingredientService.js');

    await expect(deleteIngredientById('user-1', 'other-user-ingredient')).rejects.toMatchObject({
      status: 404,
      message: 'Ingredient not found.'
    });
  });
});
