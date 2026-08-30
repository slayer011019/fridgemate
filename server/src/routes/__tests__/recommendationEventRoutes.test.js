import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serverConfig } from '../../config.js';
import {
  resetAuthSecurityStoreForTests,
  setAuthSecurityStoreForTests
} from '../../services/authSecurityStore.js';
import {
  enforceRecommendationEventCollectionPolicy,
  getRecommendationEventRateLimitKey,
  recommendationEventRoutes,
  requireRecommendationEventAuthentication
} from '../recommendationEventRoutes.js';

const originalRecommendationEventsEnabled = serverConfig.recommendationEventsEnabled;
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
  const routeLayer = recommendationEventRoutes.stack.find((layer) => layer.route?.path === '/');
  return routeLayer.route.stack.map((layer) => layer.handle);
}

describe('recommendation event rate-limit key', () => {
  beforeEach(() => {
    serverConfig.recommendationEventsEnabled = false;
    serverConfig.runtime = 'node';
  });

  afterEach(() => {
    resetAuthSecurityStoreForTests();
  });

  afterAll(() => {
    serverConfig.recommendationEventsEnabled = originalRecommendationEventsEnabled;
    serverConfig.runtime = originalRuntime;
  });

  it('uses only userId for authenticated users behind a shared IP', () => {
    const firstUser = getRecommendationEventRateLimitKey({
      auth: { userId: 'user-1' },
      ip: '203.0.113.10'
    });
    const secondUser = getRecommendationEventRateLimitKey({
      auth: { userId: 'user-2' },
      ip: '203.0.113.10'
    });

    expect(firstUser).toBe('user:user-1');
    expect(secondUser).toBe('user:user-2');
  });

  it('uses the client address only for anonymous requests', () => {
    expect(getRecommendationEventRateLimitKey({ ip: '203.0.113.10' })).toBe(
      'client:203.0.113.10'
    );
  });

  it('returns 204 without continuing when collection is disabled', () => {
    const response = createResponse();
    const next = vi.fn();

    enforceRecommendationEventCollectionPolicy({}, response, next);

    expect(response.status).toHaveBeenCalledWith(204);
    expect(response.send).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  it('continues to the rate limiter when collection is enabled', () => {
    serverConfig.recommendationEventsEnabled = true;
    const response = createResponse();
    const next = vi.fn();

    enforceRecommendationEventCollectionPolicy({}, response, next);

    expect(next).toHaveBeenCalledWith();
    expect(response.status).not.toHaveBeenCalled();
  });

  it('rejects anonymous requests after the enabled-path rate limiter', () => {
    const response = createResponse();
    const next = vi.fn();

    requireRecommendationEventAuthentication({}, response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401, message: 'Authentication is required.' })
    );
    expect(response.status).not.toHaveBeenCalled();
  });

  it('allows authenticated requests when collection is enabled', () => {
    serverConfig.recommendationEventsEnabled = true;
    const response = createResponse();
    const next = vi.fn();

    requireRecommendationEventAuthentication({ auth: { userId: 'user-1' } }, response, next);

    expect(next).toHaveBeenCalledWith();
    expect(response.status).not.toHaveBeenCalled();
  });

  it('orders enabled policy, dynamic limiter, authentication, then persistence', () => {
    expect(getRouteMiddleware().map((middleware) => middleware.name)).toEqual([
      'enforceRecommendationEventCollectionPolicy',
      'rateLimit',
      'requireRecommendationEventAuthentication',
      'createRecommendationEventHandler'
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
    const rateLimit = getRouteMiddleware().find((middleware) => middleware.name === 'rateLimit');
    const next = vi.fn();

    await rateLimit({ ip: '203.0.113.10' }, createResponse(), next);

    expect(calls).toEqual([
      {
        scope: 'recommendation-events',
        key: 'client:203.0.113.10',
        limit: 120,
        windowMs: 60 * 1000,
        cost: 1
      }
    ]);
    expect(next).toHaveBeenCalledWith();
  });
});
