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

export async function updateIngredientById(userId, id, input) {
  const existingIngredient = await findIngredientOrThrow(userId, id);
  const ingredient = normalizeAndValidateIngredient({
    ...existingIngredient,
    ...input,
    id
  });

  return prisma.ingredient.update({
    where: { id },
    data: {
      ...ingredient,
      userId
    }
  });
}

export async function deleteIngredientById(userId, id) {
  await findIngredientOrThrow(userId, id);

  try {
    await prisma.ingredient.delete({
      where: { id }
    });
  } catch (error) {
    if (error.code === 'P2025') {
      throw createHttpError(404, 'Ingredient not found.');
    }

    throw error;
  }
}
