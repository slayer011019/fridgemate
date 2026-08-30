import { describe, expect, it } from 'vitest';
import { recipeRoutes } from '../recipeRoutes.js';

function listRoutes(router) {
  return router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods).sort()
    }));
}

describe('recipeRoutes', () => {
  it('exposes recommendation APIs without exposing the operational import handler', () => {
    expect(listRoutes(recipeRoutes)).toEqual([
      { path: '/recommendations', methods: ['get'] },
      { path: '/recommendations', methods: ['post'] },
      { path: '/recommendations/semantic', methods: ['post'] },
      { path: '/ai-suggest', methods: ['post'] }
    ]);
  });

  it('applies both user and client rate limits before semantic recommendations', () => {
    const semanticRoute = recipeRoutes.stack.find(
      (layer) => layer.route?.path === '/recommendations/semantic'
    );

    expect(semanticRoute.route.stack).toHaveLength(3);
  });

  it('rate limits existing recommendation routes that can enable semantic retrieval', () => {
    const recommendationRoutes = recipeRoutes.stack.filter(
      (layer) => layer.route?.path === '/recommendations'
    );

    expect(recommendationRoutes).toHaveLength(2);
    recommendationRoutes.forEach((route) => expect(route.route.stack).toHaveLength(3));
  });

  it('applies both user and client rate limits before AI suggestions', () => {
    const aiSuggestRoute = recipeRoutes.stack.find(
      (layer) => layer.route?.path === '/ai-suggest'
    );

    expect(aiSuggestRoute.route.stack).toHaveLength(3);
  });
});
