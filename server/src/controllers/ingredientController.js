import {
  createIngredient,
  createIngredientsBulk,
  deleteIngredientById,
  getIngredientById,
  listIngredientSyncState,
  listIngredients,
  syncIngredientChanges,
  updateIngredientById
} from '../services/ingredientService.js';
import { assertPlainObject } from '../lib/ingredientValidation.js';

export async function listIngredientsHandler(_request, response, next) {
  try {
    const ingredients = await listIngredients(_request.auth.userId);
    response.json(ingredients);
  } catch (error) {
    next(error);
  }
}

export async function getIngredientHandler(request, response, next) {
  try {
    const ingredient = await getIngredientById(request.auth.userId, request.params.id);
    response.json(ingredient);
  } catch (error) {
    next(error);
  }
}

export async function createIngredientHandler(request, response, next) {
  try {
    assertPlainObject(request.body, 'Ingredient request');
    const ingredient = await createIngredient(request.auth.userId, request.body);
    response.status(201).json(ingredient);
  } catch (error) {
    next(error);
  }
}

export async function createIngredientsBulkHandler(request, response, next) {
  try {
    assertPlainObject(request.body, 'Bulk ingredient request');
    const items = request.body.items ?? [];
    const ingredients = await createIngredientsBulk(request.auth.userId, items);
    response.status(201).json(ingredients);
  } catch (error) {
    next(error);
  }
}

export async function syncIngredientsHandler(request, response, next) {
  try {
    assertPlainObject(request.body, 'Ingredient sync request');
    const changes = request.body.changes !== undefined
      ? request.body.changes
      : request.body.items ?? [];
    const result = await syncIngredientChanges(request.auth.userId, changes);
    response.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getIngredientSyncStateHandler(request, response, next) {
  try {
    const items = await listIngredientSyncState(request.auth.userId);
    response.json({ items });
  } catch (error) {
    next(error);
  }
}

export async function updateIngredientHandler(request, response, next) {
  try {
    assertPlainObject(request.body, 'Ingredient request');
    const ingredient = await updateIngredientById(request.auth.userId, request.params.id, request.body);
    response.json(ingredient);
  } catch (error) {
    next(error);
  }
}

export async function deleteIngredientHandler(request, response, next) {
  try {
    await deleteIngredientById(request.auth.userId, request.params.id);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
}
