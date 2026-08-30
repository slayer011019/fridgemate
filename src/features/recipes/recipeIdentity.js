const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function getRecipeRawId(recipe = {}) {
  return String(
    recipe.recipeId || recipe.id || recipe.sourceRecipeId || recipe.title || recipe.name || ''
  ).trim();
}

export function getRecipeKey(recipe = {}) {
  const rawId = getRecipeRawId(recipe);
  if (!rawId || /^(?:catalog|local):/u.test(rawId)) return rawId;
  return UUID_PATTERN.test(rawId) ? `catalog:${rawId}` : `local:${rawId}`;
}

export function getRecipeName(recipe = {}) {
  return String(recipe.title || recipe.name || '').trim();
}
