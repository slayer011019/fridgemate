import {
  classifyRecipeIngredientType,
  normalizeRecipeIngredientByRule
} from '../../../src/features/recipes/recipeImport.js';

const LOW_CONFIDENCE_THRESHOLD = 0.7;
const ALLOWED_TYPES = new Set(['main', 'seasoning', 'garnish', 'liquid', 'optional']);

function clampConfidence(value, fallback = 0.5) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, parsed));
}

function normalizeLlmIngredient(sourceIngredient, llmIngredient = {}) {
  const rawName = String(sourceIngredient?.rawName || llmIngredient.rawName || '').trim();
  const normalizedName = String(llmIngredient.normalizedName || '').trim();
  const baseIngredient = normalizeRecipeIngredientByRule({
    ...sourceIngredient,
    rawName
  });
  const ingredientType = ALLOWED_TYPES.has(llmIngredient.ingredientType)
    ? llmIngredient.ingredientType
    : classifyRecipeIngredientType({
        section: sourceIngredient?.section,
        rawName,
        normalizedName: normalizedName || baseIngredient.normalizedName
      });
  const confidence = clampConfidence(llmIngredient.confidence, baseIngredient.confidence);

  return {
    ...sourceIngredient,
    rawName,
    normalizedName: normalizedName || baseIngredient.normalizedName,
    ingredientType,
    confidence,
    reviewNeeded: confidence < LOW_CONFIDENCE_THRESHOLD
  };
}

function normalizeByRule(rawIngredients = []) {
  return rawIngredients.map((ingredient) => normalizeRecipeIngredientByRule(ingredient));
}

function buildNormalizationPrompt(rawIngredients = []) {
  return [
    'Normalize Korean recipe ingredient names for a fridge menu recommendation app.',
    'Return only a JSON array. Preserve rawName exactly. Normalize only normalizedName.',
    'ingredientType must be one of: main, seasoning, garnish, liquid, optional.',
    'confidence must be a number from 0 to 1.',
    JSON.stringify(
      rawIngredients.map((ingredient) => ({
        rawName: ingredient.rawName,
        section: ingredient.section,
        amountText: ingredient.amountText
      }))
    )
  ].join('\n');
}

function parseJsonArray(text) {
  const trimmed = String(text || '').trim();
  const withoutFence = trimmed.replace(/^```json\s*/iu, '').replace(/^```\s*/iu, '').replace(/```$/iu, '').trim();
  const parsed = JSON.parse(withoutFence);

  if (!Array.isArray(parsed)) {
    throw new Error('LLM normalization response was not an array.');
  }

  return parsed;
}

async function normalizeWithAnthropic(rawIngredients = [], options = {}) {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY ?? '';
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  if (!apiKey || typeof fetchImpl !== 'function') {
    throw new Error('LLM normalization is not configured.');
  }

  const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: options.model ?? process.env.RECIPE_NORMALIZATION_MODEL ?? 'claude-sonnet-4-20250514',
      max_tokens: 1800,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: buildNormalizationPrompt(rawIngredients)
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`LLM normalization request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const text = Array.isArray(payload?.content)
    ? payload.content
        .filter((part) => part?.type === 'text')
        .map((part) => part.text)
        .join('\n')
    : '';

  return parseJsonArray(text);
}

/**
 * @param {import('../../../src/features/recipes/recipeImport.js').ParsedRecipeIngredient[]} rawIngredients
 * @param {{ llmClient?: Function, fetchImpl?: typeof fetch, apiKey?: string, model?: string }} [options]
 * @returns {Promise<import('../../../src/features/recipes/recipeImport.js').NormalizedIngredient[]>}
 */
export async function normalizeIngredientsWithLLM(rawIngredients = [], options = {}) {
  try {
    const llmResult = typeof options.llmClient === 'function'
      ? await options.llmClient(rawIngredients)
      : await normalizeWithAnthropic(rawIngredients, options);

    if (!Array.isArray(llmResult)) {
      throw new Error('LLM normalizer returned a non-array result.');
    }

    return rawIngredients.map((ingredient, index) => normalizeLlmIngredient(ingredient, llmResult[index]));
  } catch (_error) {
    return normalizeByRule(rawIngredients);
  }
}
