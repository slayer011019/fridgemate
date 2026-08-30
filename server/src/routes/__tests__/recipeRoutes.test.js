import { afterEach, describe, expect, it } from 'vitest';
import {
  resetAuthSecurityStoreForTests,
  setAuthSecurityStoreForTests
} from '../../services/authSecurityStore.js';
import {
  getRecipeComputationRateLimitCost,
  getSemanticRecommendationRateLimitCost,
  recipeRoutes
} from '../recipeRoutes.js';

function listRoutes(router) {
  return router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods).sort()
    }));
}

describe('recipeRoutes', () => {
  afterEach(() => {
    resetAuthSecurityStoreForTests();
  });

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

  it('keeps automatic recommendation routes on their non-semantic budgets', () => {
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

  it('charges recipe computation limits by bounded ingredient work', () => {
    expect(getRecipeComputationRateLimitCost({ body: { ingredients: ['계란'] } })).toBe(1);
    expect(getRecipeComputationRateLimitCost({ body: { ingredients: Array(50).fill('계란') } })).toBe(5);
    expect(
      getRecipeComputationRateLimitCost({ body: { availableIngredients: Array(5_000).fill('계란') } })
    ).toBe(50);
  });

  it('charges the bounded stored-ingredient workload for body-less semantic requests', () => {
    expect(getSemanticRecommendationRateLimitCost({})).toBe(5);
    expect(getSemanticRecommendationRateLimitCost({ body: { ingredients: [] } })).toBe(5);
    expect(
      getSemanticRecommendationRateLimitCost({ body: { ingredients: Array(50).fill('계란') } })
    ).toBe(5);
    expect(
      getSemanticRecommendationRateLimitCost({
        body: { availableIngredients: Array(5_000).fill('계란') }
      })
    ).toBe(50);
  });

  it('uses the semantic default cost on the explicit semantic route', async () => {
    const calls = [];
    setAuthSecurityStoreForTests({
      async consumeRateLimit(options) {
        calls.push(options);
        return { allowed: true, retryAfterSeconds: 0 };
      }
    });
    const recommendationRoute = recipeRoutes.stack.find(
      (layer) => layer.route?.path === '/recommendations/semantic'
    );
    const request = {
      auth: { userId: 'user-1' },
      ip: '203.0.113.10'
    };

    for (const layer of recommendationRoute.route.stack.slice(0, 2)) {
      await layer.handle(request, {}, () => {});
    }

    expect(calls).toEqual([
      {
        scope: 'semantic-recommendations-user',
        key: 'user:user-1',
        limit: 30,
        windowMs: 60 * 60 * 1000,
        cost: 5
      },
      {
        scope: 'semantic-recommendations-client',
        key: '203.0.113.10',
        limit: 60,
        windowMs: 60 * 60 * 1000,
        cost: 5
      }
    ]);
  });
});
