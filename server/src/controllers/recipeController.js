import { getAiRecipeSuggestions, getRecipeRecommendations } from '../services/recipeService.js';

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
