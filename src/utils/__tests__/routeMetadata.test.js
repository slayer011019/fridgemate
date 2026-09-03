import { describe, expect, it } from 'vitest';
import { getRouteMetadata, PUBLIC_ROUTES } from '../routeMetadata';

describe('routeMetadata', () => {
  it('gives each public content page its own canonical URL', () => {
    const home = getRouteMetadata('/');
    const recipes = getRouteMetadata('/recipes');

    expect(home.canonical).toBe('https://xn--wh1bs8l5xa003adme.com/');
    expect(recipes.canonical).toBe('https://xn--wh1bs8l5xa003adme.com/recipes');
    expect(recipes.title).not.toBe(home.title);
    expect(recipes.indexable).toBe(true);
  });

  it.each(['/login', '/signup', '/account', '/ingredients/new', '/ingredients/item-id/edit', '/import'])(
    'keeps functional route %s out of the search index',
    (pathname) => {
      const metadata = getRouteMetadata(pathname);

      expect(metadata.indexable).toBe(false);
      expect(metadata.notFound).toBe(false);
    }
  );

  it('marks unknown routes as not found and non-indexable', () => {
    const metadata = getRouteMetadata('/missing-page');

    expect(metadata.indexable).toBe(false);
    expect(metadata.notFound).toBe(true);
  });

  it('publishes only the five maintained public pages', () => {
    expect(PUBLIC_ROUTES).toEqual(['/', '/recipes', '/about', '/contact', '/privacy']);
    expect(getRouteMetadata('/recipes/removed-recipe')).toMatchObject({
      indexable: false,
      notFound: true
    });
    expect(getRouteMetadata('/guides/removed-guide')).toMatchObject({
      indexable: false,
      notFound: true
    });
  });
});
