import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import { authenticatedApiRateLimits } from '../../middleware/authenticatedApiRateLimit.js';
import {
  resetAuthSecurityStoreForTests,
  setAuthSecurityStoreForTests
} from '../../services/authSecurityStore.js';

const PROTECTED_API_PATHS = [
  '/api/ingredients',
  '/api/menu-decisions',
  '/api/pantry-ownership',
  '/api/user-preferences',
  '/api/import',
  '/api/recipes'
];

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

describe('protected API shared rate limits', () => {
  afterEach(() => resetAuthSecurityStoreForTests());

  it('mounts user and client guards after authentication on every protected API router', () => {
    for (const path of PROTECTED_API_PATHS) {
      const matchingLayers = createApp().router.stack.filter((layer) => layer.match(path));
      const requireAuthIndex = matchingLayers.findIndex((layer) => layer.name === 'requireAuth');

      expect(matchingLayers.slice(requireAuthIndex, requireAuthIndex + 4).map((layer) => layer.name)).toEqual([
        'requireAuth',
        'rateLimit',
        'rateLimit',
        'router'
      ]);
    }
  });

  it('uses independent user keys and only a high-capacity shared client key behind NAT', async () => {
    const calls = [];
    setAuthSecurityStoreForTests({
      async consumeRateLimit(options) {
        calls.push(options);
        return { allowed: true, retryAfterSeconds: 0 };
      }
    });
    const requests = [
      { auth: { userId: 'user-1' }, ip: '203.0.113.10' },
      { auth: { userId: 'user-2' }, ip: '203.0.113.10' }
    ];

    for (const request of requests) {
      for (const middleware of authenticatedApiRateLimits) {
        await middleware(request, createResponse(), vi.fn());
      }
    }

    expect(calls).toEqual([
      {
        scope: 'authenticated-api-user-minute',
        key: 'user:user-1',
        limit: 300,
        windowMs: 60 * 1000,
        cost: 1
      },
      {
        scope: 'authenticated-api-client-minute',
        key: 'client:203.0.113.10',
        limit: 6_000,
        windowMs: 60 * 1000,
        cost: 1
      },
      {
        scope: 'authenticated-api-user-minute',
        key: 'user:user-2',
        limit: 300,
        windowMs: 60 * 1000,
        cost: 1
      },
      {
        scope: 'authenticated-api-client-minute',
        key: 'client:203.0.113.10',
        limit: 6_000,
        windowMs: 60 * 1000,
        cost: 1
      }
    ]);
  });

  it('returns 429 before protected handlers when the shared user budget is exhausted', async () => {
    setAuthSecurityStoreForTests({
      async consumeRateLimit() {
        return { allowed: false, retryAfterSeconds: 30 };
      }
    });
    const response = createResponse();
    const next = vi.fn();

    await authenticatedApiRateLimits[0](
      { auth: { userId: 'user-1' }, ip: '203.0.113.10' },
      response,
      next
    );

    expect(next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(429);
    expect(response.headers['Retry-After']).toBe('30');
    expect(response.body).toEqual({
      message: 'Too many authenticated API requests. Please try again later.'
    });
  });
});
