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

function openRawDatabase(name) {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(name, 2);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writeRawIngredient(databaseName, ingredient) {
  const database = await openRawDatabase(databaseName);
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('ingredients', 'readwrite');
      transaction.objectStore('ingredients').put(ingredient);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
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
    expect(await db.getIngredientById('deleted', { scope: 'user:user-1' })).toBeUndefined();
    expect(await db.getAllIngredientsForSync({ scope: 'user:user-1' })).toEqual([{
      id: 'deleted',
      clientId: 'deleted',
      updatedAt: '2026-08-26T10:00:00.000Z',
      deletedAt: '2026-08-26T10:00:00.000Z',
      syncState: 'pendingDelete'
    }]);
  });

  it('scrubs a legacy full tombstone on first sync read and keeps the rewrite idempotent', async () => {
    const db = await loadIndexedDbModule();
    const scope = { scope: 'user:user-legacy' };
    await db.saveIngredient(createIngredient('legacy-delete'), scope);
    await writeRawIngredient('fridgemate-db__user_user-legacy', createIngredient('legacy-delete', {
      clientId: 'legacy-delete',
      memo: 'private legacy memo',
      createdAt: '2026-08-01T00:00:00.000Z',
      deletedAt: '2026-08-26T10:00:00.000Z'
    }));

    const firstRead = await db.getAllIngredientsForSync(scope);
    const secondRead = await db.getAllIngredientsForSync(scope);

    expect(firstRead).toEqual([{
      id: 'legacy-delete',
      clientId: 'legacy-delete',
      updatedAt: '2026-08-26T10:00:00.000Z',
      deletedAt: '2026-08-26T10:00:00.000Z',
      syncState: 'pendingDelete'
    }]);
    expect(secondRead).toEqual(firstRead);
  });

  it('rejects stale active writes and replacement snapshots over an existing tombstone', async () => {
    const db = await loadIndexedDbModule();
    const scope = { scope: 'user:user-1' };
    await db.saveIngredient(createIngredient('deleted', {
      clientId: 'stable-delete-key',
      updatedAt: '2026-08-26T10:00:00.000Z',
      deletedAt: '2026-08-26T10:00:00.000Z',
      syncState: 'clean'
    }), scope);

    await expect(db.saveIngredient(createIngredient('deleted', {
      clientId: 'stable-delete-key',
      name: 'must-not-return',
      updatedAt: '2026-08-26T11:00:00.000Z'
    }), scope)).rejects.toThrow(/cannot be restored/u);
    await expect(db.replaceIngredients([createIngredient('server-active', {
      clientId: 'stable-delete-key',
      name: 'must-not-return',
      updatedAt: '2026-08-26T12:00:00.000Z'
    })], scope)).rejects.toThrow(/cannot be restored/u);

    await expect(db.replaceIngredients([], scope)).resolves.toBeNull();

    expect(await db.getAllIngredientsForSync(scope)).toEqual([{
      id: 'deleted',
      clientId: 'stable-delete-key',
      updatedAt: '2026-08-26T10:00:00.000Z',
      deletedAt: '2026-08-26T10:00:00.000Z',
      syncState: 'clean'
    }]);
  });

  it('stores menu decisions in the upgraded database without affecting ingredients', async () => {
    const db = await loadIndexedDbModule();
    const decision = {
      decisionDate: '2026-08-30',
      clientId: 'decision-1',
      recipeKey: 'local:recipe-1',
      status: 'selected'
    };

    await db.saveIngredient(createIngredient('ingredient-1'));
    await db.saveMenuDecision(decision);

    expect(await db.getMenuDecision('2026-08-30')).toEqual(decision);
    expect(await db.getAllIngredients()).toHaveLength(1);
    await db.deleteMenuDecision('2026-08-30');
    expect(await db.getMenuDecision('2026-08-30')).toBeUndefined();
  });

  it('isolates guest and authenticated menu decisions', async () => {
    const db = await loadIndexedDbModule();
    await db.saveMenuDecision({ decisionDate: '2026-08-30', clientId: 'guest' }, { scope: 'guest' });
    await db.saveMenuDecision({ decisionDate: '2026-08-30', clientId: 'user' }, { scope: 'user:user-1' });

    expect(await db.getMenuDecision('2026-08-30', { scope: 'guest' })).toMatchObject({ clientId: 'guest' });
    expect(await db.getMenuDecision('2026-08-30', { scope: 'user:user-1' })).toMatchObject({ clientId: 'user' });
  });

  it('closes and deletes an authenticated scope database without deleting guest data', async () => {
    const db = await loadIndexedDbModule();
    await db.saveIngredient(createIngredient('guest-1'), { scope: 'guest' });
    await db.saveIngredient(createIngredient('user-1'), { scope: 'user:user-1' });
    await db.saveIngredient(createIngredient('user-2'), { scope: 'user:user-2' });

    await expect(db.deleteDatabase({ scope: 'user:user-1' })).resolves.toBeUndefined();

    const databaseNames = (await window.indexedDB.databases()).map(({ name }) => name);
    expect(databaseNames).not.toContain('fridgemate-db__user_user-1');
    expect(databaseNames).toContain('fridgemate-db__guest');
    expect(databaseNames).toContain('fridgemate-db__user_user-2');
    expect(await db.getAllIngredients({ scope: 'guest' })).toHaveLength(1);
    expect(await db.getAllIngredients({ scope: 'user:user-2' })).toHaveLength(1);
    expect(await db.getAllIngredients({ scope: 'user:user-1' })).toEqual([]);
  });

  it('can clear scoped records before another connection blocks database deletion', async () => {
    const db = await loadIndexedDbModule();
    await db.saveIngredient(createIngredient('user-1'), { scope: 'user:user-1' });
    await db.saveMenuDecision(
      { decisionDate: '2026-08-30', clientId: 'decision-1' },
      { scope: 'user:user-1' }
    );
    const blockingConnection = await new Promise((resolve, reject) => {
      const request = window.indexedDB.open('fridgemate-db__user_user-1', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    try {
      await db.clearIngredients({ scope: 'user:user-1' });
      await db.clearMenuDecisions({ scope: 'user:user-1' });

      expect(await db.getAllIngredients({ scope: 'user:user-1' })).toEqual([]);
      expect(await db.getMenuDecision('2026-08-30', { scope: 'user:user-1' })).toBeUndefined();
      await expect(db.deleteDatabase({ scope: 'user:user-1' })).rejects.toThrow(/blocked/i);
    } finally {
      blockingConnection.close();
    }
  });
});
