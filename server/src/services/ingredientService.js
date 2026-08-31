import { withUserDatabaseScope } from '../db/tenantScope.js';
import { createHttpError } from '../lib/httpError.js';
import {
  assertIngredientBatch,
  assertPlainObject,
  assertValidIngredient,
  assertValidIngredientSyncTimestamps,
  createScrubbedIngredientTombstone,
  normalizeIngredientIdentifier,
  normalizeIngredientInput,
  normalizeIngredientSyncInput
} from '../lib/ingredientValidation.js';

export const MAX_INGREDIENT_RECORDS_PER_USER = 5_000;

export function serializeIngredientForSync(ingredient) {
  if (!ingredient?.deletedAt) return ingredient;

  return {
    id: ingredient.id,
    clientId: ingredient.clientId,
    userId: ingredient.userId,
    updatedAt: ingredient.updatedAt,
    deletedAt: ingredient.deletedAt
  };
}

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

function requireIngredientId(id) {
  const normalizedId = normalizeIngredientIdentifier(id);
  if (!normalizedId) {
    throw createHttpError(400, 'Ingredient id is required.');
  }
  return normalizedId;
}

async function lockIngredientQuota(database, userId) {
  await database.$queryRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))::text AS "lock"
  `;
}

function assertIngredientCapacity(recordCount, additionalCount) {
  if (recordCount + additionalCount > MAX_INGREDIENT_RECORDS_PER_USER) {
    throw createHttpError(
      409,
      `Ingredient storage is limited to ${MAX_INGREDIENT_RECORDS_PER_USER} records, including deleted items.`
    );
  }
}

async function getIngredientRecordCountWithLock(database, userId) {
  await lockIngredientQuota(database, userId);
  return database.ingredient.count({ where: { userId } });
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
  const normalizedId = requireIngredientId(id);
  return withUserDatabaseScope(userId, (database) => findIngredientOrThrow(database, userId, normalizedId));
}

export async function createIngredient(userId, input) {
  const ingredient = normalizeAndValidateIngredient(input);

  return withUserDatabaseScope(userId, async (database) => {
    const recordCount = await getIngredientRecordCountWithLock(database, userId);
    assertIngredientCapacity(recordCount, 1);
    return database.ingredient.create({
      data: {
        ...ingredient,
        userId
      }
    });
  });
}

export async function createIngredientsBulk(userId, items = []) {
  assertIngredientBatch(items, 'Ingredient items');

  const normalizedItems = items.map((item) => normalizeAndValidateIngredient(item));

  return withUserDatabaseScope(userId, async (database) => {
    const recordCount = await getIngredientRecordCountWithLock(database, userId);
    assertIngredientCapacity(recordCount, normalizedItems.length);
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
  return withUserDatabaseScope(userId, async (database) => {
    const items = await database.ingredient.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });
    return items.map(serializeIngredientForSync);
  });
}

export async function syncIngredientChanges(userId, changes = []) {
  assertIngredientBatch(changes, 'Ingredient changes', { allowEmpty: true });
  const normalizedChanges = changes.map((item) => {
    const ingredient = normalizeIngredientSyncInput(item);
    if (!ingredient.deletedAt) assertValidIngredient(ingredient);
    assertValidIngredientSyncTimestamps(ingredient);
    return ingredient;
  });

  return withUserDatabaseScope(userId, async (database) => {
    let appliedCount = 0;
    let recordCount = normalizedChanges.length
      ? await getIngredientRecordCountWithLock(database, userId)
      : 0;

    for (const ingredient of normalizedChanges) {
      const existingIngredient = await database.ingredient.findFirst({
        where: { userId, clientId: ingredient.clientId }
      });
      const incomingUpdatedAt = new Date(ingredient.updatedAt);

      if (existingIngredient?.deletedAt && !ingredient.deletedAt) continue;
      if (existingIngredient && new Date(existingIngredient.updatedAt) >= incomingUpdatedAt) continue;

      const { id: _id, ...ingredientData } = ingredient;

      if (existingIngredient) {
        const result = await database.ingredient.updateMany({
          where: {
            userId,
            clientId: ingredient.clientId,
            updatedAt: { lt: incomingUpdatedAt },
            ...(ingredient.deletedAt ? {} : { deletedAt: null })
          },
          data: ingredientData
        });
        appliedCount += result.count;
        continue;
      }

      assertIngredientCapacity(recordCount, 1);
      try {
        await database.ingredient.create({ data: { ...ingredientData, userId } });
        recordCount += 1;
        appliedCount += 1;
      } catch (error) {
        if (error?.code !== 'P2002') throw error;

        const result = await database.ingredient.updateMany({
          where: {
            userId,
            clientId: ingredient.clientId,
            updatedAt: { lt: incomingUpdatedAt },
            ...(ingredient.deletedAt ? {} : { deletedAt: null })
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

    return { items: items.map(serializeIngredientForSync), appliedCount };
  });
}

export async function updateIngredientById(userId, id, input) {
  const normalizedId = requireIngredientId(id);
  assertPlainObject(input);
  return withUserDatabaseScope(userId, async (database) => {
    const existingIngredient = await findIngredientOrThrow(database, userId, normalizedId);
    const ingredient = normalizeAndValidateIngredient({
      ...existingIngredient,
      ...input,
      id: normalizedId
    });
    const { id: _id, ...ingredientData } = ingredient;
    const result = await database.ingredient.updateMany({
      where: {
        id: normalizedId,
        userId,
        deletedAt: null
      },
      data: ingredientData
    });

    if (result.count !== 1) {
      throw createHttpError(404, 'Ingredient not found.');
    }

    return findIngredientOrThrow(database, userId, normalizedId);
  });
}

export async function deleteIngredientById(userId, id) {
  const normalizedId = requireIngredientId(id);
  return withUserDatabaseScope(userId, async (database) => {
    const deletedAt = new Date();
    const {
      id: _id,
      clientId: _clientId,
      ...tombstoneData
    } = createScrubbedIngredientTombstone({ updatedAt: deletedAt, deletedAt });
    const result = await database.ingredient.updateMany({
      where: {
        id: normalizedId,
        userId,
        deletedAt: null
      },
      data: tombstoneData
    });

    if (result.count !== 1) {
      throw createHttpError(404, 'Ingredient not found.');
    }
  });
}
