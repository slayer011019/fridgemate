const DB_NAME_PREFIX = 'fridgemate-db';
const DB_VERSION = 2;
const STORE_NAME = 'ingredients';
const MEAL_PLAN_STORE_NAME = 'mealPlans';
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
    let abandoned = false;
    const databasePromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(databaseName, DB_VERSION);

      request.onupgradeneeded = () => {
        if (abandoned) {
          request.transaction.abort();
          return;
        }

        const database = request.result;

        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('expiryDate', 'expiryDate', { unique: false });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('storageType', 'storageType', { unique: false });
        }

        if (!database.objectStoreNames.contains(MEAL_PLAN_STORE_NAME)) {
          database.createObjectStore(MEAL_PLAN_STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        const database = request.result;

        if (abandoned) {
          database.close();
          return;
        }

        const releaseConnection = () => {
          database.close();
          if (databasePromises.get(databaseName) === databasePromise) {
            databasePromises.delete(databaseName);
          }
        };
        database.onversionchange = releaseConnection;
        database.onclose = releaseConnection;
        resolve(database);
      };
      request.onblocked = () => {
        abandoned = true;
        reject(new Error('다른 탭에서 이전 저장소를 사용 중입니다. 오늘뭐먹지 탭을 닫은 뒤 다시 시도해주세요.'));
      };
      request.onerror = () => reject(request.error);
    });

    databasePromises.set(databaseName, databasePromise);
    databasePromise.catch(() => {
      if (databasePromises.get(databaseName) === databasePromise) {
        databasePromises.delete(databaseName);
      }
    });
  }

  return databasePromises.get(databaseName);
}

function runStoreTransaction(storeName, mode, handler, scopeOrOptions) {
  return openDatabase(scopeOrOptions).then((database) => {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      let request;

      try {
        request = handler(transaction.objectStore(storeName), transaction);
      } catch (error) {
        transaction.abort();
        reject(error);
      }

      transaction.oncomplete = () => resolve(request?.result);
      transaction.onerror = () => reject(transaction.error || new Error('로컬 저장에 실패했습니다. 다시 시도해주세요.'));
      transaction.onabort = () => reject(transaction.error || new Error('로컬 저장이 취소됐습니다. 다시 시도해주세요.'));
    });
  });
}

function runTransaction(mode, handler, scopeOrOptions) {
  return runStoreTransaction(STORE_NAME, mode, handler, scopeOrOptions);
}

export function runMealPlanTransaction(mode, handler, scopeOrOptions) {
  return runStoreTransaction(MEAL_PLAN_STORE_NAME, mode, handler, scopeOrOptions);
}

// Account deletion clears private stores together; ordinary ingredient replacement must not erase plans.
export function clearAccountLocalData(scopeOrOptions) {
  return openDatabase(scopeOrOptions).then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME, MEAL_PLAN_STORE_NAME], 'readwrite');
    transaction.objectStore(STORE_NAME).clear();
    transaction.objectStore(MEAL_PLAN_STORE_NAME).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('로컬 데이터 삭제가 취소됐습니다.'));
  }));
}

export function getAllIngredients(scopeOrOptions) {
  return runTransaction('readonly', (store) => store.getAll(), scopeOrOptions).then((ingredients = []) =>
    ingredients.filter((ingredient) => !ingredient.deletedAt)
  );
}

function migrateIngredientForSync(ingredient) {
  const id = ingredient.id || ingredient.clientId;
  const migratedAt = ingredient.updatedAt || ingredient.createdAt || new Date().toISOString();

  return {
    ...ingredient,
    id,
    clientId: ingredient.clientId || id,
    createdAt: ingredient.createdAt || migratedAt,
    updatedAt: migratedAt,
    deletedAt: ingredient.deletedAt || null,
    syncState: ingredient.syncState || 'pendingCreate',
    lastSyncedAt: ingredient.lastSyncedAt || null
  };
}

export async function getAllIngredientsForSync(scopeOrOptions) {
  const ingredients = await runTransaction('readonly', (store) => store.getAll(), scopeOrOptions);
  const migratedIngredients = ingredients.map(migrateIngredientForSync);
  const needsMigration = migratedIngredients.some(
    (ingredient, index) => JSON.stringify(ingredient) !== JSON.stringify(ingredients[index])
  );

  if (needsMigration) await saveIngredients(migratedIngredients, scopeOrOptions);
  return migratedIngredients;
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
