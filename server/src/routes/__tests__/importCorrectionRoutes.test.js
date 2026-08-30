import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  resetAuthSecurityStoreForTests,
  setAuthSecurityStoreForTests
} from '../../services/authSecurityStore.js';
import {
  getImportEmbeddingRateLimitCost,
  importCorrectionRoutes
} from '../importCorrectionRoutes.js';

function findRoute(path) {
  return importCorrectionRoutes.stack.find((layer) => layer.route?.path === path)?.route;
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

describe('importCorrectionRoutes rate limits', () => {
  afterEach(() => {
    resetAuthSecurityStoreForTests();
  });

  it('caps request cost at the same 30 items processed by the service', () => {
    expect(getImportEmbeddingRateLimitCost({ body: { items: [] } })).toBe(1);
    expect(getImportEmbeddingRateLimitCost({ body: { items: [{}, {}, {}] } })).toBe(3);
    expect(getImportEmbeddingRateLimitCost({ body: { items: Array.from({ length: 31 }) } })).toBe(30);
  });

  it('applies shared user and client budgets before both embedding handlers', async () => {
    const calls = [];
    setAuthSecurityStoreForTests({
      async consumeRateLimit(options) {
        calls.push(options);
        return { allowed: true, retryAfterSeconds: 0 };
      }
    });
    const suggestionRoute = findRoute('/corrections/suggestions');
    const saveRoute = findRoute('/corrections');
    const request = {
      auth: { userId: 'user-1' },
      body: { items: Array.from({ length: 31 }) },
      ip: '203.0.113.10'
    };

    expect(suggestionRoute.stack).toHaveLength(5);
    expect(saveRoute.stack).toHaveLength(5);

    await runRateLimits(suggestionRoute, request);
    const suggestionCalls = calls.splice(0);
    await runRateLimits(saveRoute, request);

    expect(calls).toEqual(suggestionCalls);
    expect(suggestionCalls).toEqual([
      expect.objectContaining({ scope: 'import-embedding-user-minute', key: 'user:user-1', cost: 30 }),
      expect.objectContaining({ scope: 'import-embedding-user-hour', key: 'user:user-1', cost: 30 }),
      expect.objectContaining({ scope: 'import-embedding-client-minute', key: 'client:203.0.113.10', cost: 30 }),
      expect.objectContaining({ scope: 'import-embedding-client-hour', key: 'client:203.0.113.10', cost: 30 })
    ]);
  });

  it('returns 429 before the import handler when a budget is exhausted', async () => {
    setAuthSecurityStoreForTests({
      async consumeRateLimit() {
        return { allowed: false, retryAfterSeconds: 45 };
      }
    });
    const firstRateLimit = findRoute('/corrections/suggestions').stack[0].handle;
    const response = createResponse();
    const next = vi.fn();

    await firstRateLimit(
      { auth: { userId: 'user-1' }, body: { items: [{}] }, ip: '203.0.113.10' },
      response,
      next
    );

    expect(next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(429);
    expect(response.headers['Retry-After']).toBe('45');
    expect(response.body).toEqual({
      message: 'Too many import analysis requests. Please try again later.'
    });
  });
});
