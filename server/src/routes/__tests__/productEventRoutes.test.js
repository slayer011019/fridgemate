import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serverConfig } from '../../config.js';
import {
  resetAuthSecurityStoreForTests,
  setAuthSecurityStoreForTests
} from '../../services/authSecurityStore.js';
import {
  enforceProductEventCollectionPolicy,
  getProductEventRateLimitKey,
  productEventRoutes,
  requireProductEventAuthentication
} from '../productEventRoutes.js';

const originalProductEventsEnabled = serverConfig.productEventsEnabled;
const originalRuntime = serverConfig.runtime;

function createResponse() {
  return {
    json: vi.fn(),
    send: vi.fn(),
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis()
  };
}

function getRouteMiddleware() {
  const routeLayer = productEventRoutes.stack.find((layer) => layer.route?.path === '/');
  return routeLayer.route.stack.map((layer) => layer.handle);
}

describe('product event collection policy', () => {
  beforeEach(() => {
    serverConfig.productEventsEnabled = false;
    serverConfig.runtime = 'node';
  });

  afterEach(() => {
    resetAuthSecurityStoreForTests();
  });

  afterAll(() => {
    serverConfig.productEventsEnabled = originalProductEventsEnabled;
    serverConfig.runtime = originalRuntime;
  });

  it('returns 204 without continuing when collection is disabled', () => {
    const response = createResponse();
    const next = vi.fn();

    enforceProductEventCollectionPolicy({}, response, next);

    expect(response.status).toHaveBeenCalledWith(204);
    expect(response.send).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  it('continues to the rate limiter when collection is enabled', () => {
    serverConfig.productEventsEnabled = true;
    const response = createResponse();
    const next = vi.fn();

    enforceProductEventCollectionPolicy({}, response, next);

    expect(next).toHaveBeenCalledWith();
    expect(response.status).not.toHaveBeenCalled();
  });

  it('rejects anonymous requests after the enabled-path rate limiter', () => {
    const response = createResponse();
    const next = vi.fn();

    requireProductEventAuthentication({}, response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401, message: 'Authentication is required.' })
    );
    expect(response.status).not.toHaveBeenCalled();
  });

  it('uses only the authenticated user for rate limiting and collection', () => {
    serverConfig.productEventsEnabled = true;
    const response = createResponse();
    const next = vi.fn();
    const request = { auth: { userId: 'user-1' }, ip: '203.0.113.10' };

    expect(getProductEventRateLimitKey(request)).toBe('user:user-1');
    requireProductEventAuthentication(request, response, next);

    expect(next).toHaveBeenCalledWith();
    expect(response.status).not.toHaveBeenCalled();
  });

  it('uses the client address only for anonymous requests', () => {
    expect(getProductEventRateLimitKey({ ip: '203.0.113.10' })).toBe(
      'client:203.0.113.10'
    );
  });

  it('orders policy, client limiter, optional auth, event limiter, then persistence', () => {
    expect(getRouteMiddleware().map((middleware) => middleware.name)).toEqual([
      'enforceProductEventCollectionPolicy',
      'rateLimit',
      'optionalAuth',
      'rateLimit',
      'requireProductEventAuthentication',
      'createProductEventHandler'
    ]);
  });

  it('charges an anonymous enabled request to its client address before authentication', async () => {
    const calls = [];
    setAuthSecurityStoreForTests({
      async consumeRateLimit(options) {
        calls.push(options);
        return { allowed: true, retryAfterSeconds: 0 };
      }
    });
    const rateLimit = getRouteMiddleware()
      .filter((middleware) => middleware.name === 'rateLimit')
      .at(-1);
    const next = vi.fn();

    await rateLimit({ ip: '203.0.113.10' }, createResponse(), next);

    expect(calls).toEqual([
      {
        scope: 'product-events',
        key: 'client:203.0.113.10',
        limit: 180,
        windowMs: 60 * 1000,
        cost: 1
      }
    ]);
    expect(next).toHaveBeenCalledWith();
  });
});
