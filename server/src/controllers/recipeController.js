import { getAiRecipeSuggestions, getRecipeRecommendations } from '../services/recipeService.js';
import { importFoodSafetyRecipesFromXml } from '../services/recipeImportService.js';

export async function getRecipeRecommendationsHandler(request, response, next) {
  try {
    const bodyIngredients = Array.isArray(request.body?.ingredients) ? request.body.ingredients : null;
    const pantryItems = Array.isArray(request.body?.pantryItems) ? request.body.pantryItems : [];
    const recommendations = await getRecipeRecommendations({
      userId: request.auth.userId,
      ingredients: bodyIngredients,
      pantryItems
    });

    response.json(recommendations);
  } catch (error) {
    next(error);
  }
}

export async function getAiRecipeSuggestionsHandler(request, response, next) {
  try {
    const ingredients = Array.isArray(request.body?.ingredients) ? request.body.ingredients : [];
    const suggestions = await getAiRecipeSuggestions(ingredients);
    response.json(suggestions);
  } catch (error) {
    next(error);
  }
}

export async function importFoodSafetyRecipesHandler(request, response, next) {
  try {
    const xmlText = String(request.body?.xmlText || '').trim();

    if (!xmlText) {
      response.status(400).json({ message: 'xmlText is required.' });
      return;
    }

    const results = await importFoodSafetyRecipesFromXml(xmlText);
    response.status(201).json({
      importedCount: results.length,
      results
    });
  } catch (error) {
    next(error);
  }
}
