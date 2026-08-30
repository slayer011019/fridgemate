import { compactIngredientTombstone } from '../utils/syncStrategy';

const DB_NAME_PREFIX = 'fridgemate-db';
const DB_VERSION = 2;
const INGREDIENT_STORE_NAME = 'ingredients';
const MENU_DECISION_STORE_NAME = 'menuDecisions';
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

        if (!database.objectStoreNames.contains(INGREDIENT_STORE_NAME)) {
          const store = database.createObjectStore(INGREDIENT_STORE_NAME, { keyPath: 'id' });
          store.createIndex('expiryDate', 'expiryDate', { unique: false });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('storageType', 'storageType', { unique: false });
        }

        if (!database.objectStoreNames.contains(MENU_DECISION_STORE_NAME)) {
          database.createObjectStore(MENU_DECISION_STORE_NAME, { keyPath: 'decisionDate' });
        }
      };

      request.onsuccess = () => {
        const database = request.result;

        database.onversionchange = () => {
          database.close();

          if (databasePromises.get(databaseName) === databasePromise) {
            databasePromises.delete(databaseName);
          }
        };

        resolve(database);
      };
      request.onerror = () => {
        if (databasePromises.get(databaseName) === databasePromise) {
          databasePromises.delete(databaseName);
        }

        reject(request.error);
      };
    });

    databasePromises.set(databaseName, databasePromise);
  }

  return databasePromises.get(databaseName);
}

function runTransaction(mode, handler, scopeOrOptions, storeName = INGREDIENT_STORE_NAME) {
  return openDatabase(scopeOrOptions).then((database) => {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = handler(store);

      transaction.oncomplete = () => resolve(request?.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  });
}

export function getAllIngredients(scopeOrOptions) {
  return runTransaction('readonly', (store) => store.getAll(), scopeOrOptions).then((ingredients = []) =>
    ingredients.filter((ingredient) => !ingredient.deletedAt)
  );
}

function migrateIngredientForSync(ingredient) {
  const id = ingredient.id || ingredient.clientId;
  const migratedAt = ingredient.updatedAt || ingredient.deletedAt || ingredient.createdAt || new Date().toISOString();
  const migratedIngredient = {
    ...ingredient,
    id,
    clientId: ingredient.clientId || id,
    createdAt: ingredient.createdAt || migratedAt,
    updatedAt: migratedAt,
    deletedAt: ingredient.deletedAt || null,
    syncState: ingredient.syncState || (ingredient.deletedAt ? 'pendingDelete' : 'pendingCreate'),
    lastSyncedAt: ingredient.lastSyncedAt || null
  };

  return migratedIngredient.deletedAt
    ? compactIngredientTombstone(migratedIngredient)
    : migratedIngredient;
}

function prepareIngredientForStorage(ingredient) {
  return ingredient?.deletedAt ? compactIngredientTombstone(ingredient) : ingredient;
}

export class IngredientTombstoneConflictError extends Error {
  constructor() {
    super('A deleted ingredient cannot be restored without an explicit restore operation.');
    this.name = 'IngredientTombstoneConflictError';
  }
}

function getIngredientIdentityKeys(ingredient) {
  return [ingredient?.id, ingredient?.clientId].filter(Boolean);
}

function writeIngredientsWithoutResurrection(
  ingredients,
  scopeOrOptions,
  { replace = false, result = null } = {}
) {
  const preparedIngredients = ingredients.map(prepareIngredientForStorage);

  return openDatabase(scopeOrOptions).then((database) =>
    new Promise((resolve, reject) => {
      const transaction = database.transaction(INGREDIENT_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(INGREDIENT_STORE_NAME);
      const readRequest = store.getAll();
      let conflictError = null;

      readRequest.onsuccess = () => {
        const existingIngredients = readRequest.result;
        const deletedKeys = new Set(
          [...existingIngredients, ...preparedIngredients]
            .filter((ingredient) => ingredient.deletedAt)
            .flatMap(getIngredientIdentityKeys)
        );
        const wouldRestoreDeletedIngredient = preparedIngredients.some(
          (ingredient) =>
            !ingredient.deletedAt
            && getIngredientIdentityKeys(ingredient).some((key) => deletedKeys.has(key))
        );

        if (wouldRestoreDeletedIngredient) {
          conflictError = new IngredientTombstoneConflictError();
          transaction.abort();
          return;
        }

        const incomingKeys = new Set(preparedIngredients.flatMap(getIngredientIdentityKeys));
        const retainedTombstones = replace
          ? existingIngredients.filter(
            (ingredient) =>
              ingredient.deletedAt
              && !getIngredientIdentityKeys(ingredient).some((key) => incomingKeys.has(key))
          )
          : [];
        if (replace) store.clear();
        [...preparedIngredients, ...retainedTombstones]
          .map(prepareIngredientForStorage)
          .forEach((ingredient) => store.put(ingredient));
      };

      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(conflictError || transaction.error);
      transaction.onabort = () => reject(conflictError || transaction.error);
    })
  );
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

export async function getIngredientById(id, scopeOrOptions) {
  const ingredient = await runTransaction('readonly', (store) => store.get(id), scopeOrOptions);
  const preparedIngredient = prepareIngredientForStorage(ingredient);

  if (ingredient && JSON.stringify(preparedIngredient) !== JSON.stringify(ingredient)) {
    await saveIngredient(preparedIngredient, scopeOrOptions);
  }
  return preparedIngredient?.deletedAt ? undefined : preparedIngredient;
}

export function saveIngredient(ingredient, scopeOrOptions) {
  const preparedIngredient = prepareIngredientForStorage(ingredient);
  return writeIngredientsWithoutResurrection([preparedIngredient], scopeOrOptions, {
    result: preparedIngredient.id
  });
}

export function saveIngredients(ingredients, scopeOrOptions) {
  return writeIngredientsWithoutResurrection(ingredients, scopeOrOptions);
}

export function clearIngredients(scopeOrOptions) {
  return runTransaction('readwrite', (store) => store.clear(), scopeOrOptions);
}

export function replaceIngredients(ingredients = [], scopeOrOptions) {
  return writeIngredientsWithoutResurrection(ingredients, scopeOrOptions, { replace: true });
}

export function deleteIngredient(id, scopeOrOptions) {
  return runTransaction('readwrite', (store) => store.delete(id), scopeOrOptions);
}

export function getMenuDecision(decisionDate, scopeOrOptions) {
  return runTransaction(
    'readonly',
    (store) => store.get(decisionDate),
    scopeOrOptions,
    MENU_DECISION_STORE_NAME
  );
}

export function saveMenuDecision(decision, scopeOrOptions) {
  return runTransaction(
    'readwrite',
    (store) => store.put(decision),
    scopeOrOptions,
    MENU_DECISION_STORE_NAME
  );
}

export function deleteMenuDecision(decisionDate, scopeOrOptions) {
  return runTransaction(
    'readwrite',
    (store) => store.delete(decisionDate),
    scopeOrOptions,
    MENU_DECISION_STORE_NAME
  );
}

export function clearMenuDecisions(scopeOrOptions) {
  return runTransaction(
    'readwrite',
    (store) => store.clear(),
    scopeOrOptions,
    MENU_DECISION_STORE_NAME
  );
}

export async function deleteDatabase(scopeOrOptions) {
  const databaseName = getDatabaseName(scopeOrOptions);
  const cachedDatabasePromise = databasePromises.get(databaseName);

  if (cachedDatabasePromise) {
    try {
      const database = await cachedDatabasePromise;
      database.close();
    } catch {
      // A failed open does not prevent a best-effort database deletion.
    } finally {
      if (databasePromises.get(databaseName) === cachedDatabasePromise) {
        databasePromises.delete(databaseName);
      }
    }
  } else {
    databasePromises.delete(databaseName);
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.deleteDatabase(databaseName);
    let settled = false;

    request.onsuccess = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };

    request.onerror = () => {
      if (!settled) {
        settled = true;
        reject(request.error || new Error(`Failed to delete IndexedDB database: ${databaseName}`));
      }
    };

    request.onblocked = () => {
      if (!settled) {
        settled = true;
        reject(new Error(`IndexedDB database deletion was blocked: ${databaseName}`));
      }
    };
  });
}
