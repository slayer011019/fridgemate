function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeListValue(value) {
  return normalizeText(value).toLocaleLowerCase();
}

function uniqueSorted(values = []) {
  return [...new Set(values.map(normalizeListValue).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, 'ko')
  );
}

function formatLine(label, value) {
  const normalizedValue = normalizeText(value);
  return normalizedValue ? `${label}: ${normalizedValue}` : '';
}

function parseSteps(steps) {
  if (!steps) {
    return '';
  }

  if (Array.isArray(steps)) {
    return steps
      .map((step) => {
        if (typeof step === 'string') {
          return normalizeText(step);
        }

        return normalizeText(step?.text || step?.description || step?.manual || '');
      })
      .filter(Boolean)
      .slice(0, 8)
      .join(' ');
  }

  if (typeof steps === 'object') {
    return parseSteps(Object.values(steps));
  }

  return normalizeText(steps);
}

function parseRawDescription(raw) {
  if (!raw || typeof raw !== 'object') {
    return '';
  }

  return normalizeText(raw.description || raw.summary || raw.sodium_tip || raw.RCP_NA_TIP || '');
}

function collectIngredientNames(ingredients = []) {
  return uniqueSorted(
    ingredients.flatMap((ingredient) => [
      ingredient?.normalized_name,
      ingredient?.canonical_name,
      ingredient?.raw_name
    ])
  );
}

function collectIngredientCategories(ingredients = []) {
  return uniqueSorted(ingredients.map((ingredient) => ingredient?.category));
}

/**
 * Builds deterministic recipe text for embeddings from production-shaped recipe rows.
 *
 * @param {{
 *   name?: string,
 *   dish_type?: string,
 *   cooking_method?: string,
 *   ingredients_text?: string,
 *   steps?: Array|string|Object,
 *   raw?: Object
 * }} recipe
 * @param {Array<{
 *   normalized_name?: string,
 *   canonical_name?: string,
 *   category?: string,
 *   raw_name?: string
 * }>} ingredients
 * @returns {string}
 */
export function buildProductionRecipeEmbeddingText(recipe = {}, ingredients = []) {
  const ingredientNames = collectIngredientNames(ingredients);
  const ingredientCategories = collectIngredientCategories(ingredients);
  const stepsText = parseSteps(recipe.steps);
  const rawDescription = parseRawDescription(recipe.raw);
  const lines = [
    formatLine('Title', recipe.name),
    formatLine('Dish type', recipe.dish_type),
    formatLine('Cooking method', recipe.cooking_method),
    ingredientNames.length ? `Ingredients: ${ingredientNames.join(', ')}` : '',
    ingredientCategories.length ? `Ingredient categories: ${ingredientCategories.join(', ')}` : '',
    formatLine('Raw ingredients', recipe.ingredients_text),
    formatLine('Steps', stepsText),
    formatLine('Description', rawDescription)
  ];

  return lines.filter(Boolean).join('\n');
}

export function buildRecipeEmbeddingContentHash({ recipe = {}, ingredients = [], createHash }) {
  if (typeof createHash !== 'function') {
    throw new Error('createHash is required to build a recipe embedding content hash.');
  }

  return createHash('sha256')
    .update(buildProductionRecipeEmbeddingText(recipe, ingredients))
    .digest('hex');
}
