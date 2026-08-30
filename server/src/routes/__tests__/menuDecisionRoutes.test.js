import { afterEach, describe, expect, it } from 'vitest';
import {
  resetAuthSecurityStoreForTests,
  setAuthSecurityStoreForTests
} from '../../services/authSecurityStore.js';
import { menuDecisionRoutes } from '../menuDecisionRoutes.js';

function findRoute(method, path) {
  return menuDecisionRoutes.stack.find(
    (layer) => layer.route?.path === path && layer.route.methods[method]
  )?.route;
}

function createResponse() {
  return {
    setHeader() {},
    status() { return this; },
    json() { return this; }
  };
}

describe('menuDecisionRoutes write rate limits', () => {
  afterEach(() => resetAuthSecurityStoreForTests());

  it('applies user and high-capacity shared-client budgets to every write route', async () => {
    const calls = [];
    setAuthSecurityStoreForTests({
      async consumeRateLimit(options) {
        calls.push(options);
        return { allowed: true, retryAfterSeconds: 0 };
      }
    });
    const routes = [
      findRoute('put', '/:date'),
      findRoute('patch', '/:date/complete'),
      findRoute('delete', '/:date')
    ];
    const request = { auth: { userId: 'user-1' }, ip: '203.0.113.10' };

    for (const route of routes) {
      expect(route.stack).toHaveLength(5);
      for (const layer of route.stack.slice(0, -1)) {
        await layer.handle(request, createResponse(), () => {});
      }
    }

    expect(calls).toHaveLength(12);
    expect(calls.slice(0, 4)).toEqual([
      { scope: 'menu-decision-write-user-minute', key: 'user:user-1', limit: 60, windowMs: 60 * 1000, cost: 1 },
      { scope: 'menu-decision-write-user-hour', key: 'user:user-1', limit: 600, windowMs: 60 * 60 * 1000, cost: 1 },
      { scope: 'menu-decision-write-client-minute', key: 'client:203.0.113.10', limit: 600, windowMs: 60 * 1000, cost: 1 },
      { scope: 'menu-decision-write-client-hour', key: 'client:203.0.113.10', limit: 6_000, windowMs: 60 * 60 * 1000, cost: 1 }
    ]);
  });

  it('does not charge the read route', () => {
    expect(findRoute('get', '/').stack).toHaveLength(1);
  });
});
