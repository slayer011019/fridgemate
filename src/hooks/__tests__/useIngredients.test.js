import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRemainingDays } from '../../utils/date.js';

class MockIngredientsApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'IngredientsApiError';
    this.status = options.status;
    this.path = options.path;
    this.cause = options.cause;
  }
}

const apiMocks = {
  getAllIngredients: vi.fn(),
  getIngredientById: vi.fn(),
  saveIngredient: vi.fn(),
  saveIngredients: vi.fn(),
  deleteIngredient: vi.fn()
};

const dbMocks = {
  getAllIngredients: vi.fn(),
  getIngredientById: vi.fn(),
  saveIngredient: vi.fn(),
  saveIngredients: vi.fn(),
  replaceIngredients: vi.fn(),
  deleteIngredient: vi.fn()
};

const backendState = {
  enabled: false,
  preferredDataSource: 'indexeddb'
};

const authState = {
  isAuthenticated: false,
  loading: false,
  storageScope: 'guest'
};

vi.mock('../../api/ingredientsApi.js', () => ({
  IngredientsApiError: MockIngredientsApiError,
  getAllIngredients: (...args) => apiMocks.getAllIngredients(...args),
  getIngredientById: (...args) => apiMocks.getIngredientById(...args),
  saveIngredient: (...args) => apiMocks.saveIngredient(...args),
  saveIngredients: (...args) => apiMocks.saveIngredients(...args),
  deleteIngredient: (...args) => apiMocks.deleteIngredient(...args)
}));

vi.mock('../../db/indexedDB.js', () => ({
  getAllIngredients: (...args) => dbMocks.getAllIngredients(...args),
  getIngredientById: (...args) => dbMocks.getIngredientById(...args),
  saveIngredient: (...args) => dbMocks.saveIngredient(...args),
  saveIngredients: (...args) => dbMocks.saveIngredients(...args),
  replaceIngredients: (...args) => dbMocks.replaceIngredients(...args),
  deleteIngredient: (...args) => dbMocks.deleteIngredient(...args)
}));

vi.mock('../../utils/backendConfig.js', () => ({
  apiBaseUrl: '',
  isBackendEnabled: () => backendState.enabled,
  getPreferredDataSource: () => backendState.preferredDataSource
}));

vi.mock('../useAuth.js', () => ({
  useAuth: () => authState
}));

function createDeferred() {
  let resolve;
  let reject;

  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function createIngredient(id, overrides = {}) {
  return {
    id,
    name: `ingredient-${id}`,
    category: 'vegetable',
    storageType: 'fridge',
    quantity: '1 unit',
    purchaseDate: '2026-03-18',
    expiryDate: '2026-03-25',
    memo: '',
    consumed: false,
    ...overrides
  };
}

function sortByExpiryLikePage(ingredients) {
  return [...ingredients].sort((a, b) => {
    const left = getRemainingDays(a.expiryDate);
    const right = getRemainingDays(b.expiryDate);
    const leftValue = left === null ? Number.MAX_SAFE_INTEGER : left;
    const rightValue = right === null ? Number.MAX_SAFE_INTEGER : right;

    return leftValue - rightValue;
  });
}

function setGuestMode() {
  authState.isAuthenticated = false;
  authState.storageScope = 'guest';
}

function setAuthenticatedMode(userId = 'user-1') {
  authState.isAuthenticated = true;
  authState.storageScope = `user:${userId}`;
}

async function renderUseIngredients() {
  vi.resetModules();
  const { IngredientsProvider, useIngredients } = await import('../useIngredients.js');
  const wrapper = ({ children }) => createElement(IngredientsProvider, null, children);

  return renderHook(() => useIngredients(), { wrapper });
}

function resetMockState() {
  vi.clearAllMocks();
  backendState.enabled = false;
  backendState.preferredDataSource = 'indexeddb';
  setGuestMode();

  apiMocks.getAllIngredients.mockResolvedValue([]);
  apiMocks.getIngredientById.mockResolvedValue(undefined);
  apiMocks.saveIngredient.mockImplementation(async (ingredient) => ingredient);
  apiMocks.saveIngredients.mockImplementation(async (ingredients) => ingredients);
  apiMocks.deleteIngredient.mockResolvedValue(undefined);

  dbMocks.getAllIngredients.mockResolvedValue([]);
  dbMocks.getIngredientById.mockResolvedValue(undefined);
  dbMocks.saveIngredient.mockImplementation(async () => undefined);
  dbMocks.saveIngredients.mockImplementation(async () => undefined);
  dbMocks.replaceIngredients.mockImplementation(async () => undefined);
  dbMocks.deleteIngredient.mockResolvedValue(undefined);
}

describe('useIngredients', () => {
  beforeEach(() => {
    resetMockState();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('basic CRUD flow', () => {
    it('starts with an empty list and loading state before the initial fetch resolves', async () => {
      const deferred = createDeferred();
      dbMocks.getAllIngredients.mockReturnValue(deferred.promise);

      const { result } = await renderUseIngredients();

      expect(result.current.ingredients).toEqual([]);
      expect(result.current.loading).toBe(true);
      expect(result.current.dataSource).toBe('indexeddb');

      deferred.resolve([]);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.ingredients).toEqual([]);
      expect(dbMocks.getAllIngredients).toHaveBeenCalledWith({ scope: 'guest' });
    });

    it('adds, updates, and removes ingredients through the hook', async () => {
      const { result } = await renderUseIngredients();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const ingredient = createIngredient('crud-1', { name: 'green-onion', quantity: '1 bunch' });

      await act(async () => {
        await result.current.addIngredient(ingredient);
      });

      expect(result.current.ingredients).toEqual([ingredient]);
      expect(dbMocks.saveIngredient).toHaveBeenCalledWith(ingredient, { scope: 'guest' });

      const updatedIngredient = { ...ingredient, quantity: '2 bunches', memo: 'updated' };

      await act(async () => {
        await result.current.updateIngredient(updatedIngredient);
      });

      expect(result.current.ingredients[0]).toMatchObject({
        id: 'crud-1',
        quantity: '2 bunches',
        memo: 'updated'
      });

      await act(async () => {
        await result.current.removeIngredient('crud-1');
      });

      expect(result.current.ingredients).toEqual([]);
      expect(dbMocks.deleteIngredient).toHaveBeenCalledWith('crud-1', { scope: 'guest' });
    });
  });

  describe('optimistic updates in authenticated mode', () => {
    it('updates UI state before the API add request resolves', async () => {
      backendState.enabled = true;
      backendState.preferredDataSource = 'api';
      setAuthenticatedMode();
      const deferred = createDeferred();
      apiMocks.saveIngredient.mockReturnValue(deferred.promise);

      const { result } = await renderUseIngredients();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const ingredient = createIngredient('optimistic-1', { name: 'tofu' });
      let addPromise;

      act(() => {
        addPromise = result.current.addIngredient(ingredient);
      });

      expect(result.current.ingredients).toHaveLength(1);
      expect(result.current.ingredients[0]).toMatchObject({
        id: 'optimistic-1',
        name: 'tofu'
      });

      await act(async () => {
        deferred.resolve({ ...ingredient, memo: 'saved-by-api', updatedAt: '2026-04-04T10:00:00.000Z' });
        await addPromise;
      });

      expect(result.current.ingredients[0]).toMatchObject({
        id: 'optimistic-1',
        memo: 'saved-by-api',
        syncState: 'clean'
      });
    });

    it('rolls back the optimistic add when the API fails without fallback', async () => {
      backendState.enabled = true;
      backendState.preferredDataSource = 'api';
      setAuthenticatedMode();
      apiMocks.saveIngredient.mockRejectedValue(new MockIngredientsApiError('Validation failed.', { status: 400 }));

      const { result } = await renderUseIngredients();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const ingredient = createIngredient('rollback-1', { name: 'bad-item' });
      let caughtError;
      let addPromise;

      act(() => {
        addPromise = result.current.addIngredient(ingredient);
      });

      expect(result.current.ingredients.map((item) => item.id)).toContain('rollback-1');

      await act(async () => {
        try {
          await addPromise;
        } catch (error) {
          caughtError = error;
        }
      });

      expect(caughtError).toBeInstanceOf(MockIngredientsApiError);
      expect(result.current.ingredients.map((item) => item.id)).not.toContain('rollback-1');
      expect(result.current.error).toBe('Validation failed.');
    });
  });

  describe('storage fallback', () => {
    it('uses IndexedDB directly when the user is in guest mode', async () => {
      backendState.enabled = true;
      backendState.preferredDataSource = 'api';
      setGuestMode();
      dbMocks.getAllIngredients.mockResolvedValue([createIngredient('local-1', { name: 'cooking-oil' })]);

      const { result } = await renderUseIngredients();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(apiMocks.getAllIngredients).not.toHaveBeenCalled();
      expect(dbMocks.getAllIngredients).toHaveBeenCalledWith({ scope: 'guest' });
      expect(result.current.dataSource).toBe('indexeddb');
      expect(result.current.ingredients[0].name).toBe('cooking-oil');
    });

    it('falls back to the authenticated IndexedDB cache when the API load fails with a server error', async () => {
      backendState.enabled = true;
      backendState.preferredDataSource = 'api';
      setAuthenticatedMode();
      apiMocks.getAllIngredients.mockRejectedValue(new MockIngredientsApiError('Server down.', { status: 500 }));
      dbMocks.getAllIngredients.mockResolvedValue([createIngredient('fallback-1', { name: 'kimchi' })]);

      const { result } = await renderUseIngredients();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(apiMocks.getAllIngredients).toHaveBeenCalledTimes(1);
      expect(dbMocks.getAllIngredients).toHaveBeenCalledWith({ scope: 'user:user-1' });
      expect(result.current.dataSource).toBe('indexeddb');
      expect(result.current.ingredients[0].name).toBe('kimchi');
      expect(result.current.error).toBeTruthy();
    });

    it('stores a pending ingredient in the authenticated cache when the create API fails with a server error', async () => {
      backendState.enabled = true;
      backendState.preferredDataSource = 'api';
      setAuthenticatedMode();
      apiMocks.saveIngredient.mockRejectedValue(new MockIngredientsApiError('Temporary outage.', { status: 500 }));

      const { result } = await renderUseIngredients();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const ingredient = createIngredient('fallback-add-1', { name: 'pear' });

      await act(async () => {
        await result.current.addIngredient(ingredient);
      });

      expect(apiMocks.saveIngredient).toHaveBeenCalledTimes(1);
      expect(dbMocks.saveIngredient).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'fallback-add-1',
          syncState: 'pendingCreate'
        }),
        { scope: 'user:user-1' }
      );
      expect(result.current.dataSource).toBe('indexeddb');
      expect(result.current.ingredients.map((item) => item.id)).toContain('fallback-add-1');
    });
  });

  describe('backend cache mirroring', () => {
    it('mirrors successful API loads into the authenticated IndexedDB cache', async () => {
      backendState.enabled = true;
      backendState.preferredDataSource = 'api';
      setAuthenticatedMode();
      const apiIngredients = [
        createIngredient('api-load-1', { name: 'api-loaded-item', updatedAt: '2026-04-04T10:00:00.000Z' })
      ];
      apiMocks.getAllIngredients.mockResolvedValue(apiIngredients);

      const { result } = await renderUseIngredients();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.dataSource).toBe('api');
      expect(dbMocks.replaceIngredients).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            id: 'api-load-1',
            syncState: 'clean'
          })
        ],
        { scope: 'user:user-1' }
      );
      expect(result.current.ingredients[0]).toMatchObject({
        id: 'api-load-1',
        syncState: 'clean'
      });
    });

    it('mirrors successful API writes into the authenticated IndexedDB cache and exposes syncing state', async () => {
      backendState.enabled = true;
      backendState.preferredDataSource = 'api';
      setAuthenticatedMode();
      const deferred = createDeferred();
      apiMocks.saveIngredient.mockReturnValue(deferred.promise);

      const { result } = await renderUseIngredients();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const ingredient = createIngredient('api-write-1', { name: 'api-write-item' });
      let addPromise;

      act(() => {
        addPromise = result.current.addIngredient(ingredient);
      });

      expect(result.current.isSyncing).toBe(true);

      await act(async () => {
        deferred.resolve({ ...ingredient, memo: 'mirrored', updatedAt: '2026-04-04T11:00:00.000Z' });
        await addPromise;
      });

      expect(result.current.isSyncing).toBe(false);
      expect(dbMocks.saveIngredient).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'api-write-1',
          memo: 'mirrored',
          syncState: 'clean'
        }),
        { scope: 'user:user-1' }
      );
      expect(result.current.ingredients[0]).toMatchObject({
        id: 'api-write-1',
        memo: 'mirrored',
        syncState: 'clean'
      });
    });
  });

  describe('derived filtering and sorting from hook data', () => {
    it('returns data that consumers can filter by category, sort by expiry, and split by consumed status', async () => {
      setGuestMode();
      dbMocks.getAllIngredients.mockResolvedValue([
        createIngredient('sort-1', {
          name: 'milk',
          category: 'dairy',
          expiryDate: '2026-01-18',
          consumed: false
        }),
        createIngredient('sort-2', {
          name: 'green-onion',
          category: 'vegetable',
          expiryDate: '2026-01-25',
          consumed: false
        }),
        createIngredient('sort-3', {
          name: 'kimchi',
          category: 'vegetable',
          expiryDate: '2026-01-16',
          consumed: true
        }),
        createIngredient('sort-4', {
          name: 'pear',
          category: 'vegetable',
          expiryDate: '2026-01-17',
          consumed: false
        })
      ]);

      const { result } = await renderUseIngredients();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const vegetables = result.current.ingredients.filter((ingredient) => ingredient.category === 'vegetable');
      const sortedByExpiry = sortByExpiryLikePage(result.current.ingredients);
      const consumedItems = result.current.ingredients.filter((ingredient) => ingredient.consumed);
      const activeItems = result.current.ingredients.filter((ingredient) => !ingredient.consumed);

      expect(vegetables.map((ingredient) => ingredient.name)).toEqual(['green-onion', 'kimchi', 'pear']);
      expect(sortedByExpiry.map((ingredient) => ingredient.name)).toEqual(['kimchi', 'pear', 'milk', 'green-onion']);
      expect(consumedItems.map((ingredient) => ingredient.name)).toEqual(['kimchi']);
      expect(activeItems.map((ingredient) => ingredient.name)).toEqual(['milk', 'green-onion', 'pear']);
    });
  });
});
