function buildSearchUrl(baseUrl, query) {
  return `${baseUrl}${encodeURIComponent(query)}`;
}

function RecipeExternalLinks({ title }) {
  const recipeQuery = String(title || '').trim();

  if (!recipeQuery) {
    return null;
  }

  const links = [
    {
      href: buildSearchUrl('https://www.10000recipe.com/recipe/list.html?q=', recipeQuery),
      label: '만개의레시피',
      icon: '🔍'
    },
    {
      href: buildSearchUrl('https://www.youtube.com/results?search_query=', `${recipeQuery} 레시피`),
      label: '유튜브',
      icon: '▶'
    },
    {
      href: buildSearchUrl('https://search.naver.com/search.naver?query=', `${recipeQuery} 레시피`),
      label: '네이버',
      icon: '🔎'
    }
  ];

  return (
    <div className="flex flex-wrap gap-2 border-t border-slate-200/80 pt-3">
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
        >
          <span aria-hidden="true">{link.icon}</span>
          <span>{link.label}</span>
        </a>
      ))}
    </div>
  );
}

export default RecipeExternalLinks;
