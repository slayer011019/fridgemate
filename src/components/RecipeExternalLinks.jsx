import { generateRecipeSearchLinks } from '../features/recipes/recipeSearchLinks.js';

function RecipeExternalLinks({ title, recipeName, searchLinks }) {
  const resolvedRecipeName = String(recipeName || title || '').trim();
  const links = searchLinks || generateRecipeSearchLinks(resolvedRecipeName);

  if (!resolvedRecipeName) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 border-t border-slate-200/80 pt-3">
      <a
        href={links.manRecipe}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700"
      >
        만개의레시피
      </a>
      <a
        href={links.youtube}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700"
      >
        유튜브
      </a>
      <a
        href={links.naver}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700"
      >
        네이버
      </a>
    </div>
  );
}

export default RecipeExternalLinks;
