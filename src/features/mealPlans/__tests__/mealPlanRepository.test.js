import FDBFactory from 'fake-indexeddb/lib/FDBFactory';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function createPlan(scope = 'guest', overrides = {}) {
  return {
    id: 'week:2026-09-14', schemaVersion: 1, scope, weekStart: '2026-09-14',
    preferences: { servings: 1, excludedIngredients: [], dinnerDays: [0, 1, 2, 3, 4, 5, 6] },
    revision: 1, createdAt: '2026-09-12T00:00:00.000Z', updatedAt: '2026-09-12T00:00:00.000Z',
    slots: Array.from({ length: 7 }, (_, index) => {
      const date = `2026-09-${14 + index}`;
      return {
        id: `${date}:dinner`, date, mealType: 'dinner', status: 'empty', locked: false,
        servings: 1, templateKey: null, templateVersion: null, title: '', components: [], foodGroups: [], reason: '후보 없음'
      };
    }),
    ...overrides
  };
}

function openRaw(version, upgrade) {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open('fridgemate-db__guest', version);
    request.onupgradeneeded = () => upgrade?.(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function rawWrite(database, storeName, item) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(item);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

describe('meal plan persistence', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: new FDBFactory() });
  });

  it('upgrades v1 without changing existing ingredients', async () => {
    const old = await openRaw(1, (database) => database.createObjectStore('ingredients', { keyPath: 'id' }));
    const ingredient = { id: 'old-tofu', quantity: '반 모', consumed: false };
    await rawWrite(old, 'ingredients', ingredient);
    old.close();
    const { getMealPlan, saveMealPlan } = await import('../mealPlanRepository.js');
    const { getAllIngredients } = await import('../../../db/indexedDB.js');

    expect(await getMealPlan('2026-09-14', 'guest')).toBeNull();
    await saveMealPlan(createPlan(), 'guest');
    expect(await getAllIngredients()).toEqual([ingredient]);
    const upgraded = await openRaw(3);
    expect(upgraded.version).toBe(3);
    expect(Array.from(upgraded.objectStoreNames)).toEqual(['ingredients', 'mealPlans', 'menuDecisions']);
    upgraded.close();
  });

  it('upgrades main v2 while preserving ingredients and menu decisions', async () => {
    const old = await openRaw(2, (database) => {
      database.createObjectStore('ingredients', { keyPath: 'id' });
      database.createObjectStore('menuDecisions', { keyPath: 'decisionDate' });
    });
    const ingredient = { id: 'main-tofu', quantity: '반 모', consumed: false };
    const decision = { decisionDate: '2026-09-14', recipeId: 'recipe-1', status: 'selected' };
    await rawWrite(old, 'ingredients', ingredient);
    await rawWrite(old, 'menuDecisions', decision);
    old.close();
    const repository = await import('../mealPlanRepository.js');
    const db = await import('../../../db/indexedDB.js');

    expect(await repository.getMealPlan('2026-09-14')).toBeNull();
    const plan = createPlan();
    await repository.saveMealPlan(plan);
    expect(await repository.getMealPlan('2026-09-14')).toEqual(plan);
    expect(await db.getAllIngredients()).toEqual([ingredient]);
    expect(await db.getMenuDecision('2026-09-14')).toEqual(decision);
    const upgraded = await openRaw(3);
    expect(upgraded.version).toBe(3);
    expect(Array.from(upgraded.objectStoreNames)).toEqual(['ingredients', 'mealPlans', 'menuDecisions']);
    upgraded.close();
  });

  it('upgrades feature v2 while preserving ingredients and saved meal plan snapshots', async () => {
    const old = await openRaw(2, (database) => {
      database.createObjectStore('ingredients', { keyPath: 'id' });
      database.createObjectStore('mealPlans', { keyPath: 'id' });
    });
    const ingredient = { id: 'feature-tofu', quantity: '한 모', consumed: false };
    const plan = createPlan('guest', { revision: 4 });
    await rawWrite(old, 'ingredients', ingredient);
    await rawWrite(old, 'mealPlans', plan);
    old.close();
    const repository = await import('../mealPlanRepository.js');
    const db = await import('../../../db/indexedDB.js');

    expect(await repository.getMealPlan('2026-09-14')).toEqual(plan);
    expect(await db.getAllIngredients()).toEqual([ingredient]);
    expect(await db.getMenuDecision('2026-09-14')).toBeUndefined();
    const decision = { decisionDate: '2026-09-14', recipeId: 'recipe-1', status: 'selected' };
    await db.saveMenuDecision(decision);
    expect(await db.getMenuDecision('2026-09-14')).toEqual(decision);
    expect(await repository.getMealPlan('2026-09-14')).toEqual(plan);
    const upgraded = await openRaw(3);
    expect(upgraded.version).toBe(3);
    expect(Array.from(upgraded.objectStoreNames)).toEqual(['ingredients', 'mealPlans', 'menuDecisions']);
    upgraded.close();
  });

  it('keeps guest, users, and weeks separate and clears only the requested plans', async () => {
    const repository = await import('../mealPlanRepository.js');
    const db = await import('../../../db/indexedDB.js');
    for (const scope of ['guest', 'user:alice', 'user:bob']) {
      await repository.saveMealPlan(createPlan(scope), scope);
    }
    await db.saveIngredient({ id: 'keep-me' });
    expect(await repository.getMealPlan('2026-09-21', 'guest')).toBeNull();
    await repository.clearMealPlans('user:alice');
    expect(await repository.getMealPlan('2026-09-14', 'user:alice')).toBeNull();
    expect((await repository.getMealPlan('2026-09-14', 'guest')).scope).toBe('guest');
    expect((await repository.getMealPlan('2026-09-14', 'user:bob')).scope).toBe('user:bob');
    expect(await db.getAllIngredients()).toEqual([{ id: 'keep-me' }]);
  });

  it('refuses cross-scope writes and malformed plans without overwriting a saved week', async () => {
    const repository = await import('../mealPlanRepository.js');
    const original = createPlan();
    await repository.saveMealPlan(original);
    await expect(repository.saveMealPlan(createPlan('user:alice'), 'guest')).rejects.toThrow('다른 계정');
    await expect(repository.saveMealPlan(createPlan('guest', { slots: [], revision: 2 }))).rejects.toThrow('형식');
    await expect(repository.getMealPlan('2026-02-30')).rejects.toThrow('날짜');
    await expect(repository.getMealPlan('2026-09-14', 'user:a:b')).rejects.toThrow('계정');
    expect(await repository.getMealPlan('2026-09-14')).toEqual(original);
  });

  it('refuses reading or overwriting future or corrupt stored data', async () => {
    const repository = await import('../mealPlanRepository.js');
    await repository.getMealPlan('2026-09-14');
    const raw = await openRaw(3);
    for (const invalid of [createPlan('guest', { schemaVersion: 7 }), createPlan('guest', { slots: [{}] })]) {
      await rawWrite(raw, 'mealPlans', invalid);
      await expect(repository.getMealPlan('2026-09-14')).rejects.toThrow();
      await expect(repository.saveMealPlan(createPlan('guest', { revision: 9 }))).rejects.toThrow();
      const stored = await new Promise((resolve) => {
        const request = raw.transaction('mealPlans').objectStore('mealPlans').get(invalid.id);
        request.onsuccess = () => resolve(request.result);
      });
      expect(stored).toEqual(invalid);
    }
    raw.close();
  });

  it('atomically rejects stale revisions from another tab', async () => {
    const repository = await import('../mealPlanRepository.js');
    await repository.saveMealPlan(createPlan());
    const first = createPlan('guest', { revision: 2, updatedAt: '2026-09-12T01:00:00.000Z' });
    const stale = createPlan('guest', { revision: 2, preferences: { servings: 2, excludedIngredients: [], dinnerDays: [0] } });
    const results = await Promise.allSettled([repository.saveMealPlan(first), repository.saveMealPlan(stale)]);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
    expect(await repository.getMealPlan('2026-09-14')).toEqual(first);
  });

  it('roundtrips generated snapshots and rejects malformed nested ingredients before UI use', async () => {
    const repository = await import('../mealPlanRepository.js');
    const { generateMealPlan } = await import('../mealPlanDomain.js');
    const generated = generateMealPlan({ weekStart: '2026-09-14', scope: 'guest', now: '2026-09-12T00:00:00.000Z' });
    await repository.saveMealPlan(generated);
    expect(await repository.getMealPlan('2026-09-14')).toEqual(generated);
    const raw = await openRaw(3);
    for (const malformed of [null, { selected: true, rawName: {} }, { selected: true, rawName: '두부', foodGroups: 'proteinFoods' }]) {
      const corrupted = structuredClone(generated);
      corrupted.slots[0].components[0].ingredients = [malformed];
      await rawWrite(raw, 'mealPlans', corrupted);
      await expect(repository.getMealPlan('2026-09-14')).rejects.toThrow('형식');
    }
    const unknownStatus = structuredClone(generated);
    unknownStatus.slots[0].status = 'cooked';
    await rawWrite(raw, 'mealPlans', unknownStatus);
    await expect(repository.getMealPlan('2026-09-14')).rejects.toThrow('형식');
    raw.close();
  });

  it('preserves previous data when put cannot clone the new value', async () => {
    const repository = await import('../mealPlanRepository.js');
    await repository.saveMealPlan(createPlan());
    await expect(repository.saveMealPlan(createPlan('guest', { revision: 2, invalid: () => {} }))).rejects.toThrow();
    expect((await repository.getMealPlan('2026-09-14')).revision).toBe(1);
  });

  it('rejects non-text notices on read and write without replacing stored data', async () => {
    const repository = await import('../mealPlanRepository.js');
    const original = createPlan();
    await repository.saveMealPlan(original);
    const malformed = createPlan('guest', { revision: 2 });
    malformed.slots[0].notice = { message: 'Not a renderable notice' };
    await expect(repository.saveMealPlan(malformed)).rejects.toThrow('형식');
    expect(await repository.getMealPlan('2026-09-14')).toEqual(original);

    const raw = await openRaw(3);
    await rawWrite(raw, 'mealPlans', malformed);
    await expect(repository.getMealPlan('2026-09-14')).rejects.toThrow('형식');
    await expect(repository.saveMealPlan(createPlan('guest', { revision: 3 }))).rejects.toThrow('형식');
    const stored = await new Promise((resolve) => {
      const request = raw.transaction('mealPlans').objectStore('mealPlans').get(malformed.id);
      request.onsuccess = () => resolve(request.result);
    });
    expect(stored).toEqual(malformed);
    raw.close();
  });

  it('reports a blocked upgrade and allows retry after the older tab closes', async () => {
    const old = await openRaw(1, (database) => database.createObjectStore('ingredients', { keyPath: 'id' }));
    const repository = await import('../mealPlanRepository.js');
    await expect(repository.getMealPlan('2026-09-14')).rejects.toThrow('다른 탭');
    old.close();
    await expect(repository.getMealPlan('2026-09-14')).resolves.toBeNull();
  });

  it('allows retry after browser access to IndexedDB fails synchronously', async () => {
    const repository = await import('../mealPlanRepository.js');
    const spy = vi.spyOn(window.indexedDB, 'open').mockImplementationOnce(() => {
      throw new DOMException('Storage access denied', 'SecurityError');
    });
    await expect(repository.getMealPlan('2026-09-14')).rejects.toThrow('Storage access denied');
    await expect(repository.getMealPlan('2026-09-14')).resolves.toBeNull();
    spy.mockRestore();
  });

  it('releases cached connections on versionchange and reopens after database deletion', async () => {
    const repository = await import('../mealPlanRepository.js');
    await repository.saveMealPlan(createPlan());
    await new Promise((resolve, reject) => {
      const request = window.indexedDB.deleteDatabase('fridgemate-db__guest');
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Connection was not released'));
    });
    await expect(repository.getMealPlan('2026-09-14')).resolves.toBeNull();
  });

  it('account deletion clears that account’s ingredients, plans and menu decisions but preserves guests', async () => {
    const repository = await import('../mealPlanRepository.js');
    const db = await import('../../../db/indexedDB.js');
    await repository.saveMealPlan(createPlan('user:alice'), 'user:alice');
    await db.saveIngredient({ id: 'alice-stock' }, 'user:alice');
    await db.saveMenuDecision({ decisionDate: '2026-09-14', recipeId: 'alice-recipe' }, 'user:alice');
    await repository.saveMealPlan(createPlan());
    await db.saveIngredient({ id: 'guest-stock' });
    const guestDecision = { decisionDate: '2026-09-14', recipeId: 'guest-recipe' };
    await db.saveMenuDecision(guestDecision);
    await db.clearAccountLocalData({ scope: 'user:alice' });
    expect(await repository.getMealPlan('2026-09-14', 'user:alice')).toBeNull();
    expect(await db.getAllIngredients('user:alice')).toEqual([]);
    expect(await db.getMenuDecision('2026-09-14', 'user:alice')).toBeUndefined();
    expect(await repository.getMealPlan('2026-09-14')).not.toBeNull();
    expect(await db.getAllIngredients()).toEqual([{ id: 'guest-stock' }]);
    expect(await db.getMenuDecision('2026-09-14')).toEqual(guestDecision);
  });
});
