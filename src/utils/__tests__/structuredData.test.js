import { describe, expect, it } from 'vitest';
import { getRouteMetadata } from '../routeMetadata';
import { getRouteStructuredData } from '../structuredData';

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
});
