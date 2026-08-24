import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRateLimit } from '../rateLimit.js';
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
});
