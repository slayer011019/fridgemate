import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { seedRecipes } from '../../../src/data/seedRecipes.js';
import { buildRecipeRecommendations } from '../../../src/utils/recommendations.js';
import { serverConfig } from '../config.js';

export const recipeRoutes = Router();

function getFallbackAiSuggestions(ingredients = []) {
  return buildRecipeRecommendations(seedRecipes, ingredients)
    .filter((recipe) => recipe.score > 0)
    .slice(0, 6)
    .map((recipe) => ({
      title: recipe.title,
      description: recipe.description,
      ingredients: [...recipe.coreIngredients, ...recipe.optionalIngredients.slice(0, 3)],
      cookingTime: recipe.cookingTime,
      difficulty: recipe.difficulty || '보통',
      tags: recipe.tags || []
    }));
}

function buildAiPrompt(ingredients = []) {
  const formattedIngredients = ingredients.map((ingredient) => ({
    name: ingredient.name,
    expiresAt: ingredient.expiresAt || null,
    quantity: ingredient.quantity ?? null
  }));

  return [
    'You are generating recipe suggestions for a fridge-management app.',
    'Prioritize ingredients expiring within 3 days and try to reduce food waste.',
    'You may suggest creative recipes that are not included in the local seed recipes.',
    'Return only a JSON array. Do not include markdown, comments, or explanations.',
    'Each item must have exactly these keys: title, description, ingredients, cookingTime, difficulty, tags.',
    'difficulty must be one of: 쉬움, 보통, 어려움.',
    'ingredients and tags must be arrays of strings.',
    '',
    `Available ingredients: ${JSON.stringify(formattedIngredients)}`
  ].join('\n');
}

function parseClaudeJson(text) {
  const trimmed = String(text || '').trim();
  const withoutFence = trimmed.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const parsed = JSON.parse(withoutFence);

  if (!Array.isArray(parsed)) {
    throw new Error('Claude response was not a JSON array.');
  }

  return parsed.map((item, index) => ({
    title: String(item?.title || `AI 추천 레시피 ${index + 1}`).trim(),
    description: String(item?.description || '').trim(),
    ingredients: Array.isArray(item?.ingredients) ? item.ingredients.map((value) => String(value).trim()).filter(Boolean) : [],
    cookingTime: String(item?.cookingTime || '').trim(),
    difficulty: ['쉬움', '보통', '어려움'].includes(item?.difficulty) ? item.difficulty : '보통',
    tags: Array.isArray(item?.tags) ? item.tags.map((value) => String(value).trim()).filter(Boolean) : []
  }));
}

async function handleRecommendations(request, response, next) {
  try {
    const bodyIngredients = Array.isArray(request.body?.ingredients) ? request.body.ingredients : null;
    const ingredients =
      bodyIngredients ||
      (await prisma.ingredient.findMany({
        orderBy: { createdAt: 'desc' }
      })).map((ingredient) => ({
        name: ingredient.name,
        expiresAt: ingredient.expiryDate || null
      }));
    const recommendations = buildRecipeRecommendations(seedRecipes, ingredients);

    response.json(recommendations);
  } catch (error) {
    next(error);
  }
}

recipeRoutes.get('/recommendations', handleRecommendations);
recipeRoutes.post('/recommendations', handleRecommendations);

recipeRoutes.post('/ai-suggest', async (request, response, next) => {
  try {
    const ingredients = Array.isArray(request.body?.ingredients) ? request.body.ingredients : [];

    if (!ingredients.length) {
      response.json([]);
      return;
    }

    if (!serverConfig.anthropicApiKey) {
      response.json(getFallbackAiSuggestions(ingredients));
      return;
    }

    try {
      const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': serverConfig.anthropicApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1400,
          temperature: 0.7,
          messages: [
            {
              role: 'user',
              content: buildAiPrompt(ingredients)
            }
          ]
        })
      });

      if (!anthropicResponse.ok) {
        throw new Error(`Anthropic API request failed with status ${anthropicResponse.status}.`);
      }

      const payload = await anthropicResponse.json();
      const text = Array.isArray(payload?.content)
        ? payload.content
            .filter((item) => item?.type === 'text')
            .map((item) => item.text)
            .join('\n')
        : '';

      response.json(parseClaudeJson(text));
    } catch (error) {
      console.warn('[recipeRoutes] Claude suggestion failed. Falling back to rule-based recommendations.', error);
      response.json(getFallbackAiSuggestions(ingredients));
    }
  } catch (error) {
    next(error);
  }
});
