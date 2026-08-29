import { describe, expect, it } from 'vitest';
import { getRouteMetadata } from '../routeMetadata';
import { getRouteStructuredData } from '../structuredData';
import { getPublicRecipePath, publicRecipeCatalog } from '../../features/recipes/publicRecipeCatalog';

describe('structuredData', () => {
  it('describes the public home page without inventing ratings or reviews', () => {
    const schemas = getRouteStructuredData('/', getRouteMetadata('/'));

    expect(schemas.map((schema) => schema['@type'])).toEqual(['WebSite', 'SoftwareApplication']);
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
    expect(schema.author.name).toBe('식품의약품안전처');
    expect(schema.isBasedOn).toBe(recipe.sourceUrl);
    expect(schema).not.toHaveProperty('aggregateRating');
  });
});
