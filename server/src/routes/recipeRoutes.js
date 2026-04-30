import { Router } from 'express';
import {
  getAiRecipeSuggestionsHandler,
  getRecipeRecommendationsHandler,
  importFoodSafetyRecipesHandler
} from '../controllers/recipeController.js';

export const recipeRoutes = Router();

recipeRoutes.get('/recommendations', getRecipeRecommendationsHandler);
recipeRoutes.post('/recommendations', getRecipeRecommendationsHandler);
recipeRoutes.post('/ai-suggest', getAiRecipeSuggestionsHandler);
recipeRoutes.post('/import/food-safety', importFoodSafetyRecipesHandler);
