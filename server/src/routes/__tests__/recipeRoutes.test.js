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
      { path: '/ai-suggest', methods: ['post'] }
    ]);
  });
});
