import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  ingredient: {
    deleteMany: vi.fn(),
    findMany: vi.fn(),
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
});
