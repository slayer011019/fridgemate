import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('authSecurityStore', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.JWT_SECRET = '12345678901234567890123456789012';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/fridgemate';
    process.env.JWT_ISSUER = 'fridgemate-api';
    process.env.JWT_AUDIENCE = 'fridgemate-client';
    process.env.NODE_ENV = 'test';
  });

  afterEach(async () => {
    const authSecurityStore = await import('../authSecurityStore.js');
    authSecurityStore.resetAuthSecurityStoreForTests();
  });

  it('falls back to memory when the active redis rate limit operation fails', async () => {
    const authSecurityStore = await import('../authSecurityStore.js');
    const failingStore = {
      async consumeRateLimit() {
        throw new Error('redis down');
      },
      async revokeToken() {},
      async isTokenRevoked() {
        return false;
      },
      async disconnect() {},
      clear() {}
    };

    authSecurityStore.setAuthSecurityStoreForTests(failingStore, 'redis');

    await expect(
      authSecurityStore.consumeAuthRateLimit({
        scope: 'login-email',
        key: 'user@example.com',
        limit: 2,
        windowMs: 60_000
      })
    ).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0
    });

    expect(authSecurityStore.getAuthSecurityStoreMode()).toBe('memory');
  });

  it('falls back to memory when token revocation checks fail', async () => {
    const authSecurityStore = await import('../authSecurityStore.js');
    const failingStore = {
      async consumeRateLimit() {
        return { allowed: true, retryAfterSeconds: 0 };
      },
      async revokeToken() {
        throw new Error('redis down');
      },
      async isTokenRevoked() {
        throw new Error('redis down');
      },
      async disconnect() {},
      clear() {}
    };

    authSecurityStore.setAuthSecurityStoreForTests(failingStore, 'redis');

    await expect(authSecurityStore.revokeAuthToken('token-1', Math.floor(Date.now() / 1000) + 3600)).resolves.toBe(
      undefined
    );
    await expect(authSecurityStore.checkRevokedToken('token-1')).resolves.toBe(true);
    expect(authSecurityStore.getAuthSecurityStoreMode()).toBe('memory');
  });
});
