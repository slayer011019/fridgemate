import * as ingredientsApi from '../../api/ingredientsApi';
import { IngredientsApiError } from '../../api/ingredientsApi';
import * as indexedDb from '../../db/indexedDB';
import { markIngredientAsPending, SYNC_STATE } from '../../utils/syncStrategy';

function shouldFallbackToIndexedDb(error) {
  if (!(error instanceof IngredientsApiError)) {
    return false;
  }

  return !error.status || error.status >= 500;
}

function buildScopeOptions(scope) {
  return { scope };
}

function buildPendingIngredient(ingredient, pendingSyncState) {
  return markIngredientAsPending(
    {
      ...ingredient,
      updatedAt: ingredient.updatedAt || new Date().toISOString()
    },
    pendingSyncState
  );
}

async function executeRepositoryCommand({ apiOperation, fallbackOperation, useApi, allowFallback = true }) {
  if (!useApi) {
    return {
      result: await fallbackOperation(),
      source: 'indexeddb',
      usedFallback: false
    };
  }

  try {
    return {
      result: await apiOperation(),
      source: 'api',
      usedFallback: false
    };
  } catch (error) {
    if (!allowFallback || !shouldFallbackToIndexedDb(error)) {
      throw error;
    }

    return {
      result: await fallbackOperation(),
      source: 'indexeddb',
      usedFallback: true,
      fallbackError: error
    };
  }
}

export function loadIngredientsFromRepository({ scope, useApi }) {
  return executeRepositoryCommand({
    useApi,
    apiOperation: () => ingredientsApi.getAllIngredients(),
    fallbackOperation: () => indexedDb.getAllIngredients(buildScopeOptions(scope))
  });
}

export function findIngredientInRepository({ id, scope, useApi }) {
  return executeRepositoryCommand({
    useApi,
    apiOperation: () => ingredientsApi.getIngredientById(id),
    fallbackOperation: () => indexedDb.getIngredientById(id, buildScopeOptions(scope))
  });
}

export function saveIngredientInRepository({
  ingredient,
  scope,
  useApi,
  pendingSyncState = SYNC_STATE.PENDING_UPDATE
}) {
  return executeRepositoryCommand({
    useApi,
    apiOperation: () => ingredientsApi.saveIngredient(ingredient),
    fallbackOperation: async () => {
      const fallbackIngredient = useApi ? buildPendingIngredient(ingredient, pendingSyncState) : ingredient;
      await indexedDb.saveIngredient(fallbackIngredient, buildScopeOptions(scope));
      return fallbackIngredient;
    }
  });
}

export function saveIngredientsInRepository({
  ingredients,
  scope,
  useApi,
  pendingSyncState = SYNC_STATE.PENDING_CREATE
}) {
  return executeRepositoryCommand({
    useApi,
    apiOperation: () => ingredientsApi.saveIngredients(ingredients),
    fallbackOperation: async () => {
      const fallbackIngredients = useApi
        ? ingredients.map((ingredient) => buildPendingIngredient(ingredient, pendingSyncState))
        : ingredients;
      await indexedDb.saveIngredients(fallbackIngredients, buildScopeOptions(scope));
      return fallbackIngredients;
    }
  });
}

export async function syncIngredientsToServerInRepository(ingredients = []) {
  return ingredientsApi.saveIngredients(ingredients);
}

export function removeIngredientFromRepository({ id, scope, useApi, allowFallback = !useApi }) {
  return executeRepositoryCommand({
    useApi,
    allowFallback,
    apiOperation: () => ingredientsApi.deleteIngredient(id),
    fallbackOperation: () => indexedDb.deleteIngredient(id, buildScopeOptions(scope))
  });
}

export const ingredientCache = {
  getAll: (options) => indexedDb.getAllIngredients(options),
  getById: (id, options) => indexedDb.getIngredientById(id, options),
  save: (ingredient, options) => indexedDb.saveIngredient(ingredient, options),
  saveMany: (ingredients, options) => indexedDb.saveIngredients(ingredients, options),
  replaceAll: (ingredients, options) => indexedDb.replaceIngredients(ingredients, options),
  clearAll: (options) => indexedDb.clearIngredients(options),
  remove: (id, options) => indexedDb.deleteIngredient(id, options)
};
