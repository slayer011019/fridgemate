import { describe, expect, it } from 'vitest';
import { getRouteMetadata } from '../routeMetadata';
import { getRouteStructuredData } from '../structuredData';
import { getPublicRecipePath, publicRecipeCatalog } from '../../features/recipes/publicRecipeCatalog';

describe('structuredData', () => {
  it('describes the public home page without inventing ratings or reviews', () => {
    const schemas = getRouteStructuredData('/', getRouteMetadata('/'));

    expect(schemas.map((schema) => schema['@type'])).toEqual(['WebSite', 'SoftwareApplication']);
    expect(schemas[0]).toMatchObject({
      '@id': 'https://xn--wh1bs8l5xa003adme.com/#website',
      name: '오늘뭐먹지',
      alternateName: ['오늘 뭐 먹지', 'FridgeMate'],
      url: 'https://xn--wh1bs8l5xa003adme.com/'
    });
    expect(schemas[1].alternateName).toEqual(['오늘 뭐 먹지', 'FridgeMate']);
    expect(JSON.stringify(schemas)).not.toMatch(/aggregateRating|review/);
  });

  it.each([
    ['/recipes', 'CollectionPage'],
    ['/about', 'AboutPage'],
    ['/contact', 'ContactPage'],
    ['/privacy', 'WebPage']
  ])('uses truthful page schema for %s', (pathname, expectedType) => {
    const [schema] = getRouteStructuredData(pathname, getRouteMetadata(pathname));

    expect(schema['@type']).toBe(expectedType);
    expect(schema.url).toBe(`https://xn--wh1bs8l5xa003adme.com${pathname}`);
    expect(schema.isPartOf).toMatchObject({
      '@id': 'https://xn--wh1bs8l5xa003adme.com/#website',
      name: '오늘뭐먹지',
      alternateName: ['오늘 뭐 먹지', 'FridgeMate']
    });
  });

  it('does not emit structured data for functional or unknown routes', () => {
    expect(getRouteStructuredData('/account', getRouteMetadata('/account'))).toEqual([]);
    expect(getRouteStructuredData('/missing', getRouteMetadata('/missing'))).toEqual([]);
  });

  it('emits source-backed Recipe markup with real ingredients and steps', () => {
    const recipe = publicRecipeCatalog[0];
    const pathname = getPublicRecipePath(recipe);
    const metadata = getRouteMetadata(pathname);
    const [schema] = getRouteStructuredData(pathname, metadata);

    expect(schema['@type']).toBe('Recipe');
    expect(schema.name).toBe(recipe.name);
    expect(schema.image.length).toBeGreaterThan(0);
    expect(schema.recipeIngredient.length).toBeGreaterThan(0);
    expect(schema.recipeInstructions).toHaveLength(recipe.steps.length);
    expect(schema.recipeYield).toBe(1);
    expect(schema.keywords).toContain('저염 레시피');
    expect(schema.author.name).toBe('식품의약품안전처');
    expect(schema.isBasedOn).toBe(recipe.sourceUrl);
    expect(schema.isPartOf['@id']).toBe('https://xn--wh1bs8l5xa003adme.com/#website');
    expect(schema).not.toHaveProperty('aggregateRating');
  });

  it('defines the source-backed one-serving yield for every public recipe', () => {
    publicRecipeCatalog.forEach((recipe) => {
      const pathname = getPublicRecipePath(recipe);
      const [schema] = getRouteStructuredData(pathname, getRouteMetadata(pathname));

      expect(schema.recipeYield).toBe(1);
      expect(schema.keywords).toBeTruthy();
      expect(schema).not.toHaveProperty('aggregateRating');
      expect(schema).not.toHaveProperty('prepTime');
      expect(schema).not.toHaveProperty('cookTime');
      expect(schema).not.toHaveProperty('recipeCuisine');
    });
  });

  it('emits CollectionPage and ItemList schemas for ingredient hubs', () => {
    const pathname = '/recipes/ingredients/tofu';
    const schemas = getRouteStructuredData(pathname, getRouteMetadata(pathname));

    expect(schemas.map((schema) => schema['@type'])).toEqual(['CollectionPage', 'ItemList']);
    expect(schemas[1].numberOfItems).toBeGreaterThan(0);
    expect(schemas[1].itemListElement[0]).toMatchObject({
      '@type': 'ListItem',
      position: 1
    });
    expect(schemas[1].itemListElement[0].url).toMatch(/^https:\/\/xn--wh1bs8l5xa003adme\.com\/recipes\//u);
  });

  it('uses truthful WebPage structured data for public guides', () => {
    const pathname = '/guides/use-expiring-ingredients';
    const [schema] = getRouteStructuredData(pathname, getRouteMetadata(pathname));

    expect(schema['@type']).toBe('WebPage');
    expect(schema.name).toContain('유통기한 임박 재료');
    expect(schema.url).toBe(`https://xn--wh1bs8l5xa003adme.com${pathname}`);
  });
});
