import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { seedRecipes } from '../../../src/data/seedRecipes.js';
import { buildRecipeRecommendations } from '../../../src/utils/recommendations.js';

export const recipeRoutes = Router();

async function handleRecommendations(request, response, next) {
  try {
    const ingredients = await prisma.ingredient.findMany({
      orderBy: { createdAt: 'desc' }
    });
    const pantryOwnership =
      request.body && typeof request.body.pantryOwnership === 'object' && request.body.pantryOwnership !== null
        ? request.body.pantryOwnership
        : {};
    const recommendations = buildRecipeRecommendations(seedRecipes, ingredients, { pantryOwnership });

    response.json(recommendations);
  } catch (error) {
    next(error);
  }
}

recipeRoutes.get('/recommendations', handleRecommendations);
recipeRoutes.post('/recommendations', handleRecommendations);
