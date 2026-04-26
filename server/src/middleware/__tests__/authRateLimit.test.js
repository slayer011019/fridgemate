import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('authRateLimit', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.JWT_SECRET = '12345678901234567890123456789012';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/fridgemate';
    process.env.JWT_ISSUER = 'fridgemate-api';
    process.env.JWT_AUDIENCE = 'fridgemate-client';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('limits repeated attempts by normalized email', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-17T00:00:00.000Z'));
    const { clearAuthRateLimitStore, createAuthRateLimit } = await import('../authRateLimit.js');
    clearAuthRateLimitStore();
    const middleware = createAuthRateLimit({
      scope: 'login-email',
      limit: 2,
      windowMs: 60_000,
      key: (request) => request.body.email
    });
    const next = vi.fn();

    await middleware({ body: { email: 'USER@example.com' } }, createResponse(), next);
    await middleware({ body: { email: 'user@example.com' } }, createResponse(), next);

    const response = createResponse();
    await middleware({ body: { email: 'user@example.com' } }, response, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(response.statusCode).toBe(429);
    expect(response.headers['Retry-After']).toBe('60');
    expect(response.body).toEqual({
      message: 'Too many authentication attempts. Please try again later.'
    });
  });
});
