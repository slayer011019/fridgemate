import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { createHttpError } from '../lib/httpError.js';
import { assertValidIngredient, normalizeIngredientInput } from '../lib/ingredientValidation.js';

export const ingredientRoutes = Router();

function normalizeAndValidateIngredient(input) {
  const ingredient = normalizeIngredientInput(input);
  assertValidIngredient(ingredient);
  return ingredient;
}

async function findIngredientOrThrow(id) {
  const ingredient = await prisma.ingredient.findUnique({
    where: { id }
  });

  if (!ingredient) {
    throw createHttpError(404, 'Ingredient not found.');
  }

  return ingredient;
}

ingredientRoutes.get('/', async (_request, response, next) => {
  try {
    const ingredients = await prisma.ingredient.findMany({
      orderBy: { createdAt: 'desc' }
    });

    response.json(ingredients);
  } catch (error) {
    next(error);
  }
});

ingredientRoutes.get('/:id', async (request, response, next) => {
  try {
    const ingredient = await findIngredientOrThrow(request.params.id);
    response.json(ingredient);
  } catch (error) {
    next(error);
  }
});

ingredientRoutes.post('/', async (request, response, next) => {
  try {
    const ingredient = normalizeAndValidateIngredient(request.body);

    const createdIngredient = await prisma.ingredient.create({
      data: ingredient
    });

    response.status(201).json(createdIngredient);
  } catch (error) {
    next(error);
  }
});

ingredientRoutes.post('/bulk', async (request, response, next) => {
  try {
    const items = Array.isArray(request.body?.items) ? request.body.items : [];

    if (!items.length) {
      throw createHttpError(400, 'At least one ingredient is required.');
    }

    const normalizedItems = items.map((item) => normalizeAndValidateIngredient(item));

    const createdIngredients = await prisma.$transaction(
      normalizedItems.map((ingredient) =>
        prisma.ingredient.create({
          data: ingredient
        })
      )
    );

    response.status(201).json(createdIngredients);
  } catch (error) {
    next(error);
  }
});

ingredientRoutes.patch('/:id', async (request, response, next) => {
  try {
    const existingIngredient = await findIngredientOrThrow(request.params.id);

    const ingredient = normalizeAndValidateIngredient({
      ...existingIngredient,
      ...request.body,
      id: request.params.id
    });

    const updatedIngredient = await prisma.ingredient.update({
      where: { id: request.params.id },
      data: ingredient
    });

    response.json(updatedIngredient);
  } catch (error) {
    next(error);
  }
});

ingredientRoutes.delete('/:id', async (request, response, next) => {
  try {
    await prisma.ingredient.delete({
      where: { id: request.params.id }
    });

    response.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      next(createHttpError(404, 'Ingredient not found.'));
      return;
    }

    next(error);
  }
});
