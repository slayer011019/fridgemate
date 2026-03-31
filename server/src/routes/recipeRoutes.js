import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { seedRecipes } from '../../../src/data/seedRecipes.js';
import { buildRecipeRecommendations } from '../../../src/utils/recommendations.js';

export const recipeRoutes = Router();

recipeRoutes.get('/recommendations', async (_request, response, next) => {
  try {
    const ingredients = await prisma.ingredient.findMany();
    const recommendations = buildRecipeRecommendations(seedRecipes, ingredients);

    response.json(recommendations);
  } catch (error) {
    next(error);
  }
});
