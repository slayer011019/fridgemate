import { prisma } from '../db/prisma.js';
import { createHttpError } from '../lib/httpError.js';
import { assertValidIngredient, normalizeIngredientInput } from '../lib/ingredientValidation.js';

function normalizeAndValidateIngredient(input) {
  const ingredient = normalizeIngredientInput(input);
  assertValidIngredient(ingredient);
  return ingredient;
}

async function findIngredientOrThrow(userId, id) {
  const ingredient = await prisma.ingredient.findFirst({
    where: { id, userId }
  });

  if (!ingredient) {
    throw createHttpError(404, 'Ingredient not found.');
  }

  return ingredient;
}

export async function listIngredients(userId) {
  return prisma.ingredient.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getIngredientById(userId, id) {
  return findIngredientOrThrow(userId, id);
}

export async function createIngredient(userId, input) {
  const ingredient = normalizeAndValidateIngredient(input);

  return prisma.ingredient.create({
    data: {
      ...ingredient,
      userId
    }
  });
}

export async function createIngredientsBulk(userId, items = []) {
  if (!items.length) {
    throw createHttpError(400, 'At least one ingredient is required.');
  }

  const normalizedItems = items.map((item) => normalizeAndValidateIngredient(item));

  return prisma.$transaction(
    normalizedItems.map((ingredient) =>
      prisma.ingredient.create({
        data: {
          ...ingredient,
          userId
        }
      })
    )
  );
}

export async function replaceIngredientsForUser(userId, items = []) {
  const normalizedItems = items.map((item) => normalizeAndValidateIngredient(item));
  const syncedClientIds = normalizedItems.map((ingredient) => ingredient.clientId);

  // MVP manual sync is local-first: the current local snapshot wins.
  // Rows are upserted by clientId so repeated syncs do not create duplicates.
  const operations = [
    prisma.ingredient.deleteMany({
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
    }),
    ...normalizedItems.map((ingredient) =>
      prisma.ingredient.upsert({
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
      })
    )
  ];

  await prisma.$transaction(operations);

  return listIngredients(userId);
}

export async function updateIngredientById(userId, id, input) {
  const existingIngredient = await findIngredientOrThrow(userId, id);
  const ingredient = normalizeAndValidateIngredient({
    ...existingIngredient,
    ...input,
    id
  });
  const { id: _id, ...ingredientData } = ingredient;
  const result = await prisma.ingredient.updateMany({
    where: {
      id,
      userId
    },
    data: ingredientData
  });

  if (result.count !== 1) {
    throw createHttpError(404, 'Ingredient not found.');
  }

  return findIngredientOrThrow(userId, id);
}

export async function deleteIngredientById(userId, id) {
  const result = await prisma.ingredient.deleteMany({
    where: {
      id,
      userId
    }
  });

  if (result.count !== 1) {
    throw createHttpError(404, 'Ingredient not found.');
  }
}
