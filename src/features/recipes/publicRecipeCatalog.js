import publicRecipes from '../../data/publicRecipes.json' with { type: 'json' };

const RECIPE_PATH_PREFIX = '/recipes/';

function normalizeSlugPart(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

export function getPublicRecipeSlug(recipe) {
  return [normalizeSlugPart(recipe?.externalId), normalizeSlugPart(recipe?.name)].filter(Boolean).join('-');
}

export function getPublicRecipePath(recipe) {
  return `${RECIPE_PATH_PREFIX}${getPublicRecipeSlug(recipe)}`;
}

export function getPublicRecipeBySlug(slug) {
  let normalizedSlug;
  try {
    normalizedSlug = decodeURIComponent(String(slug || '')).normalize('NFKC');
  } catch (_error) {
    return null;
  }
  return publicRecipes.find((recipe) => getPublicRecipeSlug(recipe) === normalizedSlug) || null;
}

export function getPublicRecipeByPath(pathname) {
  if (!String(pathname || '').startsWith(RECIPE_PATH_PREFIX)) return null;
  return getPublicRecipeBySlug(String(pathname).slice(RECIPE_PATH_PREFIX.length));
}

export function getRecipeIngredientLines(recipe) {
  const lines = String(recipe?.ingredientsText || '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const normalizedName = normalizeSlugPart(recipe?.name);

  return lines.filter((line, index) => index > 0 || normalizeSlugPart(line) !== normalizedName);
}

export function getPublicRecipeDescription(recipe) {
  const category = recipe?.dishType ? `${recipe.dishType} ` : '';
  const method = recipe?.cookingMethod ? `${recipe.cookingMethod} 방식으로 만드는 ` : '';
  return `${category}${recipe?.name}의 재료와 ${recipe?.steps?.length || 0}단계 조리법, 영양 정보를 식품의약품안전처 공개 데이터로 확인하세요. ${method}레시피입니다.`;
}

export const publicRecipeCatalog = Object.freeze(publicRecipes);
export const PUBLIC_RECIPE_PATHS = Object.freeze(publicRecipes.map(getPublicRecipePath));
