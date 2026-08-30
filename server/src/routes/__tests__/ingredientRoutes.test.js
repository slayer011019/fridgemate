import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  resetAuthSecurityStoreForTests,
  setAuthSecurityStoreForTests
} from '../../services/authSecurityStore.js';
import {
  getIngredientWriteRateLimitCost,
  ingredientRoutes
} from '../ingredientRoutes.js';

function findRoute(method, path) {
  return ingredientRoutes.stack.find(
    (layer) => layer.route?.path === path && layer.route.methods[method]
  )?.route;
}

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

async function runRateLimits(route, request) {
  for (const layer of route.stack.slice(0, -1)) {
    await layer.handle(request, createResponse(), vi.fn());
  }
}

describe('ingredientRoutes rate limits', () => {
  afterEach(() => {
    resetAuthSecurityStoreForTests();
  });

  it('charges one unit per changed item and caps malformed oversized batches at 50', () => {
    expect(getIngredientWriteRateLimitCost({ body: null })).toBe(1);
    expect(getIngredientWriteRateLimitCost({ body: { changes: [] } })).toBe(1);
    expect(getIngredientWriteRateLimitCost({ body: { changes: [{}, {}, {}] } })).toBe(3);
    expect(getIngredientWriteRateLimitCost({ body: { items: Array.from({ length: 51 }) } })).toBe(50);
    expect(getIngredientWriteRateLimitCost({
      body: { changes: [], items: Array.from({ length: 50 }) }
    })).toBe(50);
  });

  it('applies the same user and client budgets to every ingredient write route', async () => {
    const calls = [];
    setAuthSecurityStoreForTests({
      async consumeRateLimit(options) {
        calls.push(options);
        return { allowed: true, retryAfterSeconds: 0 };
      }
    });
    const routes = [
      findRoute('post', '/sync'),
      findRoute('post', '/'),
      findRoute('post', '/bulk'),
      findRoute('patch', '/:id'),
      findRoute('delete', '/:id')
    ];
    const request = {
      auth: { userId: 'user-1' },
      body: { changes: [{}, {}, {}] },
      ip: '203.0.113.10'
    };

    for (const route of routes) {
      expect(route.stack).toHaveLength(5);
      await runRateLimits(route, request);
    }

    const expectedCalls = [
      { scope: 'ingredient-write-user-minute', key: 'user:user-1', limit: 120, windowMs: 60 * 1000, cost: 3 },
      { scope: 'ingredient-write-user-hour', key: 'user:user-1', limit: 2_000, windowMs: 60 * 60 * 1000, cost: 3 },
      { scope: 'ingredient-write-client-minute', key: 'client:203.0.113.10', limit: 1_200, windowMs: 60 * 1000, cost: 3 },
      { scope: 'ingredient-write-client-hour', key: 'client:203.0.113.10', limit: 20_000, windowMs: 60 * 60 * 1000, cost: 3 }
    ];
    expect(calls).toEqual(routes.flatMap(() => expectedCalls));
  });

  it('applies shared user and client budgets to full ingredient snapshot routes', async () => {
    const calls = [];
    setAuthSecurityStoreForTests({
      async consumeRateLimit(options) {
        calls.push(options);
        return { allowed: true, retryAfterSeconds: 0 };
      }
    });
    const routes = [findRoute('get', '/'), findRoute('get', '/sync'), findRoute('get', '/:id')];
    const request = {
      auth: { userId: 'user-1' },
      ip: '203.0.113.10'
    };

    for (const route of routes) {
      expect(route.stack).toHaveLength(5);
      await runRateLimits(route, request);
    }

    const expectedCalls = [
      { scope: 'ingredient-read-user-minute', key: 'user:user-1', limit: 60, windowMs: 60 * 1000, cost: 1 },
      { scope: 'ingredient-read-user-hour', key: 'user:user-1', limit: 600, windowMs: 60 * 60 * 1000, cost: 1 },
      { scope: 'ingredient-read-client-minute', key: 'client:203.0.113.10', limit: 600, windowMs: 60 * 1000, cost: 1 },
      { scope: 'ingredient-read-client-hour', key: 'client:203.0.113.10', limit: 6_000, windowMs: 60 * 60 * 1000, cost: 1 }
    ];
    expect(calls).toEqual(routes.flatMap(() => expectedCalls));

  });

  it('returns 429 before the ingredient handler when a budget is exhausted', async () => {
    setAuthSecurityStoreForTests({
      async consumeRateLimit() {
        return { allowed: false, retryAfterSeconds: 30 };
      }
    });
    const firstRateLimit = findRoute('post', '/sync').stack[0].handle;
    const response = createResponse();
    const next = vi.fn();

    await firstRateLimit(
      { auth: { userId: 'user-1' }, body: { changes: [{}] }, ip: '203.0.113.10' },
      response,
      next
    );

    expect(next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(429);
    expect(response.headers['Retry-After']).toBe('30');
    expect(response.body).toEqual({ message: 'Too many ingredient changes. Please try again later.' });
  });

  it('returns 429 before a full snapshot handler when its read budget is exhausted', async () => {
    setAuthSecurityStoreForTests({
      async consumeRateLimit() {
        return { allowed: false, retryAfterSeconds: 45 };
      }
    });
    const firstRateLimit = findRoute('get', '/').stack[0].handle;
    const response = createResponse();
    const next = vi.fn();

    await firstRateLimit(
      { auth: { userId: 'user-1' }, ip: '203.0.113.10' },
      response,
      next
    );

    expect(next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(429);
    expect(response.headers['Retry-After']).toBe('45');
    expect(response.body).toEqual({ message: 'Too many ingredient reads. Please try again later.' });
  });
});
