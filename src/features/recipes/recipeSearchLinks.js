/**
 * @typedef {Object} RecipeSearchLinks
 * @property {string} manRecipe
 * @property {string} youtube
 * @property {string} naver
 */

function buildSearchQuery(recipeName = '') {
  return `${String(recipeName || '').trim()} 레시피`.trim();
}

/**
 * @param {string} recipeName
 * @returns {RecipeSearchLinks}
 */
export function generateRecipeSearchLinks(recipeName = '') {
  const searchQuery = encodeURIComponent(buildSearchQuery(recipeName));

  return {
    manRecipe: `https://www.10000recipe.com/recipe/list.html?q=${searchQuery}`,
    youtube: `https://www.youtube.com/results?search_query=${searchQuery}`,
    naver: `https://search.naver.com/search.naver?query=${searchQuery}`
  };
}
