export const DEFAULT_USER = {
  id: 'user-1',
  email: 'user@example.com'
};

export function createIngredient(id, overrides = {}) {
  return {
    id,
    name: `ingredient-${id}`,
    category: '채소',
    storageType: '냉장',
    quantity: '1개',
    purchaseDate: '2026-04-14',
    expiryDate: '2026-04-20',
    memo: '',
    consumed: false,
    updatedAt: '2026-04-14T09:00:00.000Z',
    ...overrides
  };
}

export async function seedBrowserState(page, { session = null, scope = 'guest', ingredients = [], ocrResult = null } = {}) {
  await page.addInitScript(
    ({ nextSession, nextScope, nextIngredients, nextOcrResult }) => {
      const seedKey = '__fridgemate-e2e-seeded__';

      function getDatabaseName(scopeName) {
        const safeScope = String(scopeName || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');
        return `fridgemate-db__${safeScope}`;
      }

      function deleteDatabase(name) {
        return new Promise((resolve) => {
          const request = window.indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
          request.onblocked = () => resolve();
        });
      }

      function openDatabase(name) {
        return new Promise((resolve, reject) => {
          const request = window.indexedDB.open(name, 1);

          request.onupgradeneeded = () => {
            const database = request.result;

            if (!database.objectStoreNames.contains('ingredients')) {
              const store = database.createObjectStore('ingredients', { keyPath: 'id' });
              store.createIndex('expiryDate', 'expiryDate', { unique: false });
              store.createIndex('category', 'category', { unique: false });
              store.createIndex('storageType', 'storageType', { unique: false });
            }
          };

          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      }

      async function seedIngredients(scopeName, items) {
        if (!items.length) {
          return;
        }

        const database = await openDatabase(getDatabaseName(scopeName));

        await new Promise((resolve, reject) => {
          const transaction = database.transaction('ingredients', 'readwrite');
          const store = transaction.objectStore('ingredients');
          items.forEach((ingredient) => store.put(ingredient));
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error);
        });

        database.close();
      }

      window.localStorage.clear();
      window.__FRIDGEMATE_TEST__ = window.__FRIDGEMATE_TEST__ || {};
      window.__FRIDGEMATE_TEST__.setupComplete = false;

      if (nextSession) {
        window.localStorage.setItem('fridgemate-auth-session', JSON.stringify(nextSession));
      }

      if (nextOcrResult) {
        window.__FRIDGEMATE_TEST__.extractTextFromImage = async (_file, options = {}) => {
          if (typeof options.onProgress === 'function') {
            options.onProgress(1);
          }

          return nextOcrResult;
        };
      }

      if (window.sessionStorage.getItem(seedKey) === 'done') {
        window.__FRIDGEMATE_TEST__.setupComplete = true;
        return;
      }

      Promise.all([deleteDatabase(getDatabaseName('guest')), deleteDatabase(getDatabaseName('user:user-1'))])
        .then(() => seedIngredients(nextScope, nextIngredients))
        .finally(() => {
          window.sessionStorage.setItem(seedKey, 'done');
          window.__FRIDGEMATE_TEST__.setupComplete = true;
        });
    },
    {
      nextSession: session,
      nextScope: scope,
      nextIngredients: ingredients,
      nextOcrResult: ocrResult
    }
  );
}

export async function gotoAndWait(page, path = '/') {
  await page.goto(path);
  await page.waitForFunction(() => window.__FRIDGEMATE_TEST__?.setupComplete !== false);
}

export async function mockApiSession(page, { user = DEFAULT_USER, ingredients = [] } = {}) {
  const state = {
    user,
    ingredients: [...ingredients]
  };

  const jsonResponse = (route, body, status = 200) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });

  await page.route('**/api/auth/me', (route) => jsonResponse(route, state.user));
  await page.route('**/api/auth/logout', (route) => route.fulfill({ status: 204, body: '' }));
  await page.route('**/api/auth/login', async (route) => {
    const credentials = JSON.parse(route.request().postData() || '{}');
    await jsonResponse(route, {
      token: 'test-token',
      user: {
        ...state.user,
        email: credentials.email || state.user.email
      }
    });
  });

  await page.route('**/api/ingredients/bulk', async (route) => {
    const payload = JSON.parse(route.request().postData() || '{}');
    const items = Array.isArray(payload.items) ? payload.items : [];
    const savedItems = items.map((ingredient, index) => ({
      ...ingredient,
      updatedAt: `2026-04-14T09:00:0${index}.000Z`
    }));
    state.ingredients = [...savedItems, ...state.ingredients];
    await jsonResponse(route, savedItems);
  });

  await page.route('**/api/ingredients', async (route) => {
    if (route.request().method() === 'GET') {
      await jsonResponse(route, state.ingredients);
      return;
    }

    await route.fallback();
  });

  await page.route('**/api/ingredients/*', async (route) => {
    const request = route.request();
    const id = request.url().split('/').pop();

    if (request.method() === 'PATCH') {
      const payload = JSON.parse(request.postData() || '{}');
      const savedIngredient = {
        ...payload,
        id,
        updatedAt: '2026-04-14T10:00:00.000Z'
      };
      state.ingredients = [savedIngredient, ...state.ingredients.filter((ingredient) => ingredient.id !== id)];
      await jsonResponse(route, savedIngredient);
      return;
    }

    if (request.method() === 'GET') {
      const ingredient = state.ingredients.find((item) => item.id === id);
      await jsonResponse(route, ingredient || { message: 'Not found.' }, ingredient ? 200 : 404);
      return;
    }

    if (request.method() === 'DELETE') {
      state.ingredients = state.ingredients.filter((ingredient) => ingredient.id !== id);
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    await route.fallback();
  });

  return state;
}
