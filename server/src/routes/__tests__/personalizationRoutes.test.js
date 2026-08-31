import { afterEach, describe, expect, it } from 'vitest';
import {
  resetAuthSecurityStoreForTests,
  setAuthSecurityStoreForTests
} from '../../services/authSecurityStore.js';
import {
  getPersonalizationWriteCost,
  pantryOwnershipRoutes,
  userPreferenceRoutes
} from '../personalizationRoutes.js';

function findPutRoute(router) {
  return router.stack.find(
    (layer) => layer.route?.path === '/' && layer.route.methods.put
  )?.route;
}

function createResponse() {
  return {
    setHeader() {},
    status() { return this; },
    json() { return this; }
  };
}

describe('personalizationRoutes write rate limits', () => {
  afterEach(() => resetAuthSecurityStoreForTests());

  it('charges by the bounded number of preference values', () => {
    expect(getPersonalizationWriteCost({ body: null })).toBe(1);
    expect(getPersonalizationWriteCost({ body: { items: [{}, {}, {}] } })).toBe(3);
    expect(getPersonalizationWriteCost({
      body: {
        preferredIngredients: Array.from({ length: 50 }),
        dislikedIngredients: Array.from({ length: 50 })
      }
    })).toBe(100);
  });

  it('applies the same user and shared-client budgets to both write routes', async () => {
    const calls = [];
    setAuthSecurityStoreForTests({
      async consumeRateLimit(options) {
        calls.push(options);
        return { allowed: true, retryAfterSeconds: 0 };
      }
    });
    const request = {
      auth: { userId: 'user-1' },
      ip: '203.0.113.10',
      body: { items: [{}, {}, {}] }
    };

    for (const route of [findPutRoute(pantryOwnershipRoutes), findPutRoute(userPreferenceRoutes)]) {
      expect(route.stack).toHaveLength(5);
      for (const layer of route.stack.slice(0, -1)) {
        await layer.handle(request, createResponse(), () => {});
      }
    }

    expect(calls).toHaveLength(8);
    expect(calls.slice(0, 4)).toEqual([
      { scope: 'personalization-write-user-minute', key: 'user:user-1', limit: 120, windowMs: 60 * 1000, cost: 3 },
      { scope: 'personalization-write-user-hour', key: 'user:user-1', limit: 1_000, windowMs: 60 * 60 * 1000, cost: 3 },
      { scope: 'personalization-write-client-minute', key: 'client:203.0.113.10', limit: 1_200, windowMs: 60 * 1000, cost: 3 },
      { scope: 'personalization-write-client-hour', key: 'client:203.0.113.10', limit: 10_000, windowMs: 60 * 60 * 1000, cost: 3 }
    ]);
  });
});
