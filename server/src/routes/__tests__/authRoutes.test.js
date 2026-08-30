import { afterEach, describe, expect, it } from 'vitest';
import {
  resetAuthSecurityStoreForTests,
  setAuthSecurityStoreForTests
} from '../../services/authSecurityStore.js';
import { configureServerRuntime } from '../../config.js';
import { authRoutes, enforcePublicSignupPolicy } from '../authRoutes.js';

function findRoute(path) {
  return authRoutes.stack.find((layer) => layer.route?.path === path)?.route;
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
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

describe('authRoutes refresh rate limits', () => {
  afterEach(() => {
    resetAuthSecurityStoreForTests();
  });

  it('applies shared minute and hour budgets keyed by client address', async () => {
    const calls = [];
    setAuthSecurityStoreForTests({
      async consumeRateLimit(options) {
        calls.push(options);
        return { allowed: true, retryAfterSeconds: 0 };
      }
    });
    const refreshRoute = findRoute('/refresh');
    const request = { ip: '203.0.113.10' };

    expect(refreshRoute.stack).toHaveLength(3);

    for (const layer of refreshRoute.stack.slice(0, -1)) {
      await layer.handle(request, createResponse(), () => {});
    }

    expect(calls).toEqual([
      {
        scope: 'refresh-ip-minute',
        key: '203.0.113.10',
        limit: 120,
        windowMs: 60 * 1000
      },
      {
        scope: 'refresh-ip-hour',
        key: '203.0.113.10',
        limit: 1_200,
        windowMs: 60 * 60 * 1000
      }
    ]);
  });

  it('requires authentication and applies user plus client budgets to data exports', async () => {
    const calls = [];
    setAuthSecurityStoreForTests({
      async consumeRateLimit(options) {
        calls.push(options);
        return { allowed: true, retryAfterSeconds: 0 };
      }
    });
    const exportRoute = findRoute('/data-export');
    const request = {
      auth: { userId: 'user-1' },
      ip: '203.0.113.10'
    };

    expect(exportRoute.methods.post).toBe(true);
    expect(exportRoute.methods.get).toBeUndefined();

    for (const layer of exportRoute.stack.slice(1, -1)) {
      await layer.handle(request, createResponse(), () => {});
    }

    expect(calls).toEqual([
      {
        scope: 'data-export-ip',
        key: '203.0.113.10',
        limit: 10,
        windowMs: 15 * 60 * 1000
      },
      {
        scope: 'data-export-user',
        key: 'user-1',
        limit: 3,
        windowMs: 15 * 60 * 1000
      }
    ]);
  });

  it('rate limits current-user reads primarily by user with a high shared-client guard', async () => {
    const calls = [];
    setAuthSecurityStoreForTests({
      async consumeRateLimit(options) {
        calls.push(options);
        return { allowed: true, retryAfterSeconds: 0 };
      }
    });
    const currentUserRoute = findRoute('/me');
    const requests = [
      { auth: { userId: 'user-1' }, ip: '203.0.113.10' },
      { auth: { userId: 'user-2' }, ip: '203.0.113.10' }
    ];

    expect(currentUserRoute.stack).toHaveLength(4);

    for (const request of requests) {
      for (const layer of currentUserRoute.stack.slice(1, -1)) {
        await layer.handle(request, createResponse(), () => {});
      }
    }

    expect(calls).toEqual([
      {
        scope: 'auth-me-user-minute',
        key: 'user-1',
        limit: 120,
        windowMs: 60 * 1000
      },
      {
        scope: 'auth-me-client-minute',
        key: '203.0.113.10',
        limit: 6_000,
        windowMs: 60 * 1000
      },
      {
        scope: 'auth-me-user-minute',
        key: 'user-2',
        limit: 120,
        windowMs: 60 * 1000
      },
      {
        scope: 'auth-me-client-minute',
        key: '203.0.113.10',
        limit: 6_000,
        windowMs: 60 * 1000
      }
    ]);
  });

  it('keeps the pre-verification login budgets scoped to address and address/email', async () => {
    const calls = [];
    setAuthSecurityStoreForTests({
      async consumeRateLimit(options) {
        calls.push(options);
        return { allowed: true, retryAfterSeconds: 0 };
      }
    });
    const loginRoute = findRoute('/login');
    const requests = [
      {
        body: { email: ' Victim@Example.com ' },
        ip: '203.0.113.10'
      },
      {
        body: { email: 'victim@example.com' },
        ip: '198.51.100.20'
      }
    ];

    expect(loginRoute.stack).toHaveLength(3);

    for (const request of requests) {
      for (const layer of loginRoute.stack.slice(0, -1)) {
        await layer.handle(request, createResponse(), () => {});
      }
    }

    expect(calls).toEqual([
      {
        scope: 'login-ip',
        key: '203.0.113.10',
        limit: 10,
        windowMs: 15 * 60 * 1000
      },
      {
        scope: 'login-email',
        key: '203.0.113.10:victim@example.com',
        limit: 5,
        windowMs: 15 * 60 * 1000
      },
      {
        scope: 'login-ip',
        key: '198.51.100.20',
        limit: 10,
        windowMs: 15 * 60 * 1000
      },
      {
        scope: 'login-email',
        key: '198.51.100.20:victim@example.com',
        limit: 5,
        windowMs: 15 * 60 * 1000
      }
    ]);
  });

  it('rate limits unauthenticated logout database lookups by client address', async () => {
    const calls = [];
    setAuthSecurityStoreForTests({
      async consumeRateLimit(options) {
        calls.push(options);
        return { allowed: true, retryAfterSeconds: 0 };
      }
    });
    const logoutRoute = findRoute('/logout');
    const request = { ip: '203.0.113.10' };

    expect(logoutRoute.stack).toHaveLength(3);
    for (const layer of logoutRoute.stack.slice(0, -1)) {
      await layer.handle(request, createResponse(), () => {});
    }

    expect(calls).toEqual([
      {
        scope: 'logout-ip-minute',
        key: '203.0.113.10',
        limit: 120,
        windowMs: 60 * 1000
      },
      {
        scope: 'logout-ip-hour',
        key: '203.0.113.10',
        limit: 1_200,
        windowMs: 60 * 60 * 1000
      }
    ]);
  });
});

describe('public signup policy', () => {
  it('returns one static response without continuing when production signup is disabled', () => {
    configureServerRuntime({ NODE_ENV: 'production', PUBLIC_SIGNUP_ENABLED: 'false' });
    const response = createResponse();
    const next = vi.fn();

    enforcePublicSignupPolicy(
      { body: { email: 'any-address@example.com', password: 'StrongPassphrase123!' } },
      response,
      next
    );

    expect(response.statusCode).toBe(503);
    expect(response.body).toEqual({
      message: 'New account registration is temporarily unavailable.'
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('continues only when signup is explicitly enabled', () => {
    configureServerRuntime({ NODE_ENV: 'production', PUBLIC_SIGNUP_ENABLED: 'true' });
    const next = vi.fn();

    enforcePublicSignupPolicy({}, createResponse(), next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
