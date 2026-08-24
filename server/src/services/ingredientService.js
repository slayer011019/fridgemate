import { withUserDatabaseScope } from '../db/tenantScope.js';
import { createHttpError } from '../lib/httpError.js';
import { assertValidIngredient, normalizeIngredientInput } from '../lib/ingredientValidation.js';

function normalizeAndValidateIngredient(input) {
  const ingredient = normalizeIngredientInput(input);
  assertValidIngredient(ingredient);
  return ingredient;
}

async function findIngredientOrThrow(database, userId, id) {
  const ingredient = await database.ingredient.findFirst({
    where: { id, userId }
  });

  if (!ingredient) {
    throw createHttpError(404, 'Ingredient not found.');
  }

  return ingredient;
}

export async function listIngredients(userId) {
  return withUserDatabaseScope(userId, (database) =>
    database.ingredient.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })
  );
}

export async function getIngredientById(userId, id) {
  return withUserDatabaseScope(userId, (database) => findIngredientOrThrow(database, userId, id));
}

export async function createIngredient(userId, input) {
  const ingredient = normalizeAndValidateIngredient(input);

  return withUserDatabaseScope(userId, (database) =>
    database.ingredient.create({
      data: {
        ...ingredient,
        userId
      }
    })
  );
}

export async function createIngredientsBulk(userId, items = []) {
  if (!items.length) {
    throw createHttpError(400, 'At least one ingredient is required.');
  }

  const normalizedItems = items.map((item) => normalizeAndValidateIngredient(item));

  return withUserDatabaseScope(userId, async (database) => {
    const ingredients = [];

    for (const ingredient of normalizedItems) {
      ingredients.push(
        await database.ingredient.create({
          data: {
            ...ingredient,
            userId
          }
        })
      );
    }

    return ingredients;
  });
}

export async function replaceIngredientsForUser(userId, items = []) {
  const normalizedItems = items.map((item) => normalizeAndValidateIngredient(item));
  const syncedClientIds = normalizedItems.map((ingredient) => ingredient.clientId);

  return withUserDatabaseScope(userId, async (database) => {
    await database.ingredient.deleteMany({
      where: {
        userId,
        ...(syncedClientIds.length
          ? {
              clientId: {
                notIn: syncedClientIds
              }
            }
          : {})
      }
    });

    for (const ingredient of normalizedItems) {
      await database.ingredient.upsert({
        where: {
          userId_clientId: {
            userId,
            clientId: ingredient.clientId
          }
        },
        create: {
          ...ingredient,
          userId
        },
        update: {
          ...ingredient,
          userId
        }
      });
    }

    return database.ingredient.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  });
}

export async function updateIngredientById(userId, id, input) {
  return withUserDatabaseScope(userId, async (database) => {
    const existingIngredient = await findIngredientOrThrow(database, userId, id);
    const ingredient = normalizeAndValidateIngredient({
      ...existingIngredient,
      ...input,
      id
    });
    const { id: _id, ...ingredientData } = ingredient;
    const result = await database.ingredient.updateMany({
      where: {
        id,
        userId
      },
      data: ingredientData
    });

    if (result.count !== 1) {
      throw createHttpError(404, 'Ingredient not found.');
    }

    return findIngredientOrThrow(database, userId, id);
  });
}

export async function deleteIngredientById(userId, id) {
  return withUserDatabaseScope(userId, async (database) => {
    const result = await database.ingredient.deleteMany({
      where: {
        id,
        userId
      }
    });

    if (result.count !== 1) {
      throw createHttpError(404, 'Ingredient not found.');
    }
  });
}
