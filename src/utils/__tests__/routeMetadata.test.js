import { describe, expect, it } from 'vitest';
import { getRouteMetadata, PUBLIC_ROUTES } from '../routeMetadata';
import { getPublicRecipePath, publicRecipeCatalog } from '../../features/recipes/publicRecipeCatalog';

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

  it('makes only known public recipe details indexable', () => {
    const recipe = publicRecipeCatalog[0];
    const path = getPublicRecipePath(recipe);
    const metadata = getRouteMetadata(path);

    expect(metadata.indexable).toBe(true);
    expect(metadata.recipe).toEqual(recipe);
    expect(metadata.title).toContain(recipe.name);
    expect(metadata.canonical).toBe(new URL(path, 'https://오늘뭐먹지.com').href);

    expect(getRouteMetadata('/recipes/not-a-real-recipe').indexable).toBe(false);
  });

  it('publishes six ingredient hubs and two guides with unique metadata', () => {
    expect(PUBLIC_ROUTES).toHaveLength(113);

    const hub = getRouteMetadata('/recipes/ingredients/tofu');
    const guide = getRouteMetadata('/guides/fridge-cleanout');

    expect(hub).toMatchObject({ indexable: true, notFound: false });
    expect(hub.title).toContain('두부');
    expect(hub.contentHub.recipes.length).toBeGreaterThan(0);
    expect(guide).toMatchObject({ indexable: true, notFound: false });
    expect(guide.title).toContain('냉장고 파먹기');
    expect(guide.guide.steps).toHaveLength(5);

    expect(getRouteMetadata('/recipes/ingredients/unknown').indexable).toBe(false);
    expect(getRouteMetadata('/guides/unknown').indexable).toBe(false);
  });
});
