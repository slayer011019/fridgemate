import FDBFactory from 'fake-indexeddb/lib/FDBFactory';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function createIngredient(id, overrides = {}) {
  return {
    id,
    name: `ingredient-${id}`,
    category: 'vegetable',
    storageType: 'fridge',
    quantity: '1 item',
    purchaseDate: '2026-03-18',
    expiryDate: '2026-03-25',
    memo: '',
    consumed: false,
    ...overrides
  };
}

async function loadIndexedDbModule() {
  vi.resetModules();
  const factory = new FDBFactory();

  Object.defineProperty(window, 'indexedDB', {
    configurable: true,
    writable: true,
    value: factory
  });
  vi.stubGlobal('indexedDB', factory);

  return import('../indexedDB.js');
}

describe('indexedDB utilities', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves and reads a single ingredient in the default guest scope', async () => {
    const db = await loadIndexedDbModule();
    const ingredient = createIngredient('single');

    await db.saveIngredient(ingredient);

    const savedIngredient = await db.getIngredientById('single');
    const allIngredients = await db.getAllIngredients();

    expect(savedIngredient).toEqual(ingredient);
    expect(allIngredients).toHaveLength(1);
    expect(allIngredients[0]).toEqual(ingredient);
  });

  it('saves and reads multiple ingredients', async () => {
    const db = await loadIndexedDbModule();
    const ingredients = [
      createIngredient('bulk-1', { name: 'green-onion' }),
      createIngredient('bulk-2', { name: 'milk', category: 'dairy' }),
      createIngredient('bulk-3', { name: 'pear', category: 'fruit' })
    ];

    await db.saveIngredients(ingredients);

    const allIngredients = await db.getAllIngredients();

    expect(allIngredients).toHaveLength(3);
    expect(allIngredients.map((item) => item.id).sort()).toEqual(['bulk-1', 'bulk-2', 'bulk-3']);
  });

  it('updates an existing ingredient when saving with the same id', async () => {
    const db = await loadIndexedDbModule();

    await db.saveIngredient(createIngredient('update-me', { quantity: '1 item', memo: 'before' }));
    await db.saveIngredient(createIngredient('update-me', { quantity: '3 items', memo: 'after' }));

    const updatedIngredient = await db.getIngredientById('update-me');
    const allIngredients = await db.getAllIngredients();

    expect(updatedIngredient).toMatchObject({
      id: 'update-me',
      quantity: '3 items',
      memo: 'after'
    });
    expect(allIngredients).toHaveLength(1);
  });

  it('deletes an ingredient', async () => {
    const db = await loadIndexedDbModule();

    await db.saveIngredient(createIngredient('delete-me'));
    await db.deleteIngredient('delete-me');

    expect(await db.getIngredientById('delete-me')).toBeUndefined();
    expect(await db.getAllIngredients()).toEqual([]);
  });

  it('returns undefined for a missing id and allows deleting a missing id safely', async () => {
    const db = await loadIndexedDbModule();

    await db.saveIngredient(createIngredient('keep-me'));

    expect(await db.getIngredientById('missing-id')).toBeUndefined();
    await expect(db.deleteIngredient('missing-id')).resolves.toBeUndefined();

    const allIngredients = await db.getAllIngredients();
    expect(allIngredients).toHaveLength(1);
    expect(allIngredients[0].id).toBe('keep-me');
  });

  it('treats saving a missing id as creating a new ingredient', async () => {
    const db = await loadIndexedDbModule();

    await db.saveIngredient(createIngredient('new-id', { name: 'new-ingredient' }));

    expect(await db.getIngredientById('new-id')).toMatchObject({
      id: 'new-id',
      name: 'new-ingredient'
    });
    expect(await db.getAllIngredients()).toHaveLength(1);
  });

  it('starts empty again after reinitializing the database factory', async () => {
    const firstDb = await loadIndexedDbModule();
    await firstDb.saveIngredient(createIngredient('persisted'));
    expect(await firstDb.getAllIngredients()).toHaveLength(1);

    const freshDb = await loadIndexedDbModule();
    expect(await freshDb.getAllIngredients()).toEqual([]);
  });

  it('replaces the local snapshot with the latest ingredient list', async () => {
    const db = await loadIndexedDbModule();

    await db.saveIngredients([createIngredient('old-1'), createIngredient('old-2')]);
    await db.replaceIngredients([
      createIngredient('new-1', { name: 'garlic' }),
      createIngredient('new-2', { name: 'onion' })
    ]);

    const allIngredients = await db.getAllIngredients();

    expect(allIngredients.map((item) => item.id).sort()).toEqual(['new-1', 'new-2']);
  });

  it('keeps guest and authenticated scopes isolated', async () => {
    const db = await loadIndexedDbModule();

    await db.saveIngredient(createIngredient('guest-1', { name: 'guest-item' }), { scope: 'guest' });
    await db.saveIngredient(createIngredient('user-1', { name: 'user-item' }), { scope: 'user:user-1' });

    const guestIngredients = await db.getAllIngredients({ scope: 'guest' });
    const userIngredients = await db.getAllIngredients({ scope: 'user:user-1' });

    expect(guestIngredients.map((item) => item.id)).toEqual(['guest-1']);
    expect(userIngredients.map((item) => item.id)).toEqual(['user-1']);
  });

  it('migrates legacy authenticated records and preserves pending metadata across reads', async () => {
    const db = await loadIndexedDbModule();
    await db.saveIngredient(createIngredient('legacy'), { scope: 'user:user-1' });

    const firstRead = await db.getAllIngredientsForSync({ scope: 'user:user-1' });
    const secondRead = await db.getAllIngredientsForSync({ scope: 'user:user-1' });

    expect(firstRead[0]).toMatchObject({
      id: 'legacy',
      clientId: 'legacy',
      deletedAt: null,
      syncState: 'pendingCreate',
      lastSyncedAt: null
    });
    expect(secondRead).toEqual(firstRead);
  });

  it('keeps tombstones in sync storage but hides them from normal local reads', async () => {
    const db = await loadIndexedDbModule();
    const tombstone = createIngredient('deleted', {
      clientId: 'deleted',
      updatedAt: '2026-08-26T10:00:00.000Z',
      deletedAt: '2026-08-26T10:00:00.000Z',
      syncState: 'pendingDelete'
    });
    await db.saveIngredient(tombstone, { scope: 'user:user-1' });

    expect(await db.getAllIngredients({ scope: 'user:user-1' })).toEqual([]);
    expect(await db.getAllIngredientsForSync({ scope: 'user:user-1' })).toEqual([
      expect.objectContaining({ clientId: 'deleted', syncState: 'pendingDelete' })
    ]);
  });
});
