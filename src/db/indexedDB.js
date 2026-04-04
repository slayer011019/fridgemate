const DB_NAME_PREFIX = 'fridgemate-db';
const DB_VERSION = 1;
const STORE_NAME = 'ingredients';
const DEFAULT_SCOPE = 'guest';
const databasePromises = new Map();

function resolveScope(scopeOrOptions) {
  if (typeof scopeOrOptions === 'string') {
    return scopeOrOptions.trim() || DEFAULT_SCOPE;
  }

  if (scopeOrOptions && typeof scopeOrOptions === 'object' && typeof scopeOrOptions.scope === 'string') {
    return scopeOrOptions.scope.trim() || DEFAULT_SCOPE;
  }

  return DEFAULT_SCOPE;
}

function getDatabaseName(scopeOrOptions) {
  const scope = resolveScope(scopeOrOptions);
  const safeScope = scope.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${DB_NAME_PREFIX}__${safeScope}`;
}

function openDatabase(scopeOrOptions) {
  const databaseName = getDatabaseName(scopeOrOptions);

  if (!databasePromises.has(databaseName)) {
    const databasePromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(databaseName, DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('expiryDate', 'expiryDate', { unique: false });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('storageType', 'storageType', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        databasePromises.delete(databaseName);
        reject(request.error);
      };
    });

    databasePromises.set(databaseName, databasePromise);
  }

  return databasePromises.get(databaseName);
}

function runTransaction(mode, handler, scopeOrOptions) {
  return openDatabase(scopeOrOptions).then((database) => {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = handler(store);

      transaction.oncomplete = () => resolve(request?.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  });
}

export function getAllIngredients(scopeOrOptions) {
  return runTransaction('readonly', (store) => store.getAll(), scopeOrOptions);
}

export function getIngredientById(id, scopeOrOptions) {
  return runTransaction('readonly', (store) => store.get(id), scopeOrOptions);
}

export function saveIngredient(ingredient, scopeOrOptions) {
  return runTransaction('readwrite', (store) => store.put(ingredient), scopeOrOptions);
}

export function saveIngredients(ingredients, scopeOrOptions) {
  return runTransaction('readwrite', (store) => {
    ingredients.forEach((ingredient) => {
      store.put(ingredient);
    });

    return null;
  }, scopeOrOptions);
}

export function clearIngredients(scopeOrOptions) {
  return runTransaction('readwrite', (store) => store.clear(), scopeOrOptions);
}

export function replaceIngredients(ingredients = [], scopeOrOptions) {
  return runTransaction('readwrite', (store) => {
    store.clear();

    ingredients.forEach((ingredient) => {
      store.put(ingredient);
    });

    return null;
  }, scopeOrOptions);
}

export function deleteIngredient(id, scopeOrOptions) {
  return runTransaction('readwrite', (store) => store.delete(id), scopeOrOptions);
}
