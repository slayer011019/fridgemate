import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureServerRuntime } from '../../config.js';
import { createRateLimit, getClientAddress } from '../rateLimit.js';
import {
  resetAuthSecurityStoreForTests,
  setAuthSecurityStoreForTests
} from '../../services/authSecurityStore.js';

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

describe('rateLimit', () => {
  afterEach(() => {
    resetAuthSecurityStoreForTests();
    configureServerRuntime(process.env);
  });

  it('uses the Cloudflare connecting address instead of the internal Express peer', () => {
    configureServerRuntime({
      NODE_ENV: 'production',
      HYPERDRIVE: { connectionString: 'postgresql://example.invalid/fridgemate' }
    });

    expect(
      getClientAddress({
        headers: { 'cf-connecting-ip': '203.0.113.9' },
        ip: '127.0.0.1'
      })
    ).toBe('203.0.113.9');
  });

  it('returns 429 with Retry-After when the persistent limit is exhausted', async () => {
    setAuthSecurityStoreForTests({
      async consumeRateLimit() {
        return { allowed: false, retryAfterSeconds: 30 };
      }
    });
    const middleware = createRateLimit({
      scope: 'events',
      limit: 1,
      windowMs: 60_000,
      key: () => 'client',
      message: 'Too many events.'
    });
    const response = createResponse();
    const next = vi.fn();

    await middleware({}, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(429);
    expect(response.headers['Retry-After']).toBe('30');
    expect(response.body).toEqual({ message: 'Too many events.' });
  });

  it('charges the persistent limit by the bounded request cost', async () => {
    const consumeRateLimit = vi.fn(async () => ({
      allowed: true,
      retryAfterSeconds: 0
    }));
    setAuthSecurityStoreForTests({ consumeRateLimit });
    const middleware = createRateLimit({
      scope: 'import-embedding-user-minute',
      limit: 60,
      windowMs: 60_000,
      key: (request) => `user:${request.auth.userId}`,
      cost: (request) => request.body.items.length,
      message: 'Too many import analysis requests.'
    });
    const next = vi.fn();

    await middleware(
      { auth: { userId: 'user-1' }, body: { items: [{}, {}, {}] } },
      createResponse(),
      next
    );

    expect(consumeRateLimit).toHaveBeenCalledWith({
      scope: 'import-embedding-user-minute',
      key: 'user:user-1',
      limit: 60,
      windowMs: 60_000,
      cost: 3
    });
    expect(next).toHaveBeenCalledWith();
  });

  it('fails closed before reaching the store when request cost is invalid', async () => {
    const consumeRateLimit = vi.fn();
    setAuthSecurityStoreForTests({ consumeRateLimit });
    const middleware = createRateLimit({
      scope: 'invalid-cost',
      limit: 10,
      windowMs: 60_000,
      key: () => 'client',
      cost: () => 0,
      message: 'Too many requests.'
    });
    const next = vi.fn();

    await middleware({}, createResponse(), next);

    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      code: 'RATE_LIMIT_INVALID_COST',
      message: expect.stringContaining('Rate limit cost')
    }));
  });
});
