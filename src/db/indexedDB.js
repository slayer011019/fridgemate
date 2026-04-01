const DB_NAME = 'fridgemate-db';
const DB_VERSION = 1;
const STORE_NAME = 'ingredients';
let databasePromise = null;

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

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
        databasePromise = null;
        reject(request.error);
      };
    });
  }

  return databasePromise;
}

function runTransaction(mode, handler) {
  return openDatabase().then((database) => {
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

export function getAllIngredients() {
  return runTransaction('readonly', (store) => store.getAll());
}

export function getIngredientById(id) {
  return runTransaction('readonly', (store) => store.get(id));
}

export function saveIngredient(ingredient) {
  return runTransaction('readwrite', (store) => store.put(ingredient));
}

export function saveIngredients(ingredients) {
  return runTransaction('readwrite', (store) => {
    ingredients.forEach((ingredient) => {
      store.put(ingredient);
    });

    return null;
  });
}

export function deleteIngredient(id) {
  return runTransaction('readwrite', (store) => store.delete(id));
}
