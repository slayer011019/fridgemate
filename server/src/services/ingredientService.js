import { withUserDatabaseScope } from '../db/tenantScope.js';
import { createHttpError } from '../lib/httpError.js';
import {
  assertValidIngredient,
  assertValidIngredientSyncTimestamps,
  normalizeIngredientInput,
  normalizeIngredientSyncInput
} from '../lib/ingredientValidation.js';

function normalizeAndValidateIngredient(input) {
  const ingredient = normalizeIngredientInput(input);
  assertValidIngredient(ingredient);
  return ingredient;
}

async function findIngredientOrThrow(database, userId, id) {
  const ingredient = await database.ingredient.findFirst({
    where: { id, userId, deletedAt: null }
  });

  if (!ingredient) {
    throw createHttpError(404, 'Ingredient not found.');
  }

  return ingredient;
}

export async function listIngredients(userId) {
  return withUserDatabaseScope(userId, (database) =>
    database.ingredient.findMany({
      where: { userId, deletedAt: null },
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

export async function listIngredientSyncState(userId) {
  return withUserDatabaseScope(userId, (database) =>
    database.ingredient.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    })
  );
}

export async function syncIngredientChanges(userId, changes = []) {
  const normalizedChanges = changes.map((item) => {
    const ingredient = normalizeIngredientSyncInput(item);
    assertValidIngredient(ingredient);
    assertValidIngredientSyncTimestamps(ingredient);
    return ingredient;
  });

  return withUserDatabaseScope(userId, async (database) => {
    let appliedCount = 0;

    for (const ingredient of normalizedChanges) {
      const existingIngredient = await database.ingredient.findFirst({
        where: { userId, clientId: ingredient.clientId }
      });
      const incomingUpdatedAt = new Date(ingredient.updatedAt);

      if (existingIngredient && new Date(existingIngredient.updatedAt) >= incomingUpdatedAt) continue;

      const { id: _id, ...ingredientData } = ingredient;

      if (existingIngredient) {
        const result = await database.ingredient.updateMany({
          where: {
            userId,
            clientId: ingredient.clientId,
            updatedAt: { lt: incomingUpdatedAt }
          },
          data: ingredientData
        });
        appliedCount += result.count;
        continue;
      }

      try {
        await database.ingredient.create({ data: { ...ingredientData, userId } });
        appliedCount += 1;
      } catch (error) {
        if (error?.code !== 'P2002') throw error;

        const result = await database.ingredient.updateMany({
          where: {
            userId,
            clientId: ingredient.clientId,
            updatedAt: { lt: incomingUpdatedAt }
          },
          data: ingredientData
        });
        appliedCount += result.count;
      }
    }

    const items = await database.ingredient.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });

    return { items, appliedCount };
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
    const deletedAt = new Date();
    const result = await database.ingredient.updateMany({
      where: {
        id,
        userId,
        deletedAt: null
      },
      data: { deletedAt, updatedAt: deletedAt }
    });

    if (result.count !== 1) {
      throw createHttpError(404, 'Ingredient not found.');
    }
  });
}
