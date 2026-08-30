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

  it('uses per-key Durable Objects for rate limits and strongly consistent token revocation', async () => {
    const rateLimitCounts = new Map();
    const revokedTokens = new Map();
    const objectNames = [];
    const rateLimiter = {
      getByName(name) {
        objectNames.push(name);
        return {
          async consumeRateLimit({ limit, cost = 1 }) {
            const nextCount = (rateLimitCounts.get(name) || 0) + cost;
            rateLimitCounts.set(name, nextCount);
            return {
              allowed: nextCount <= limit,
              retryAfterSeconds: nextCount <= limit ? 0 : 60
            };
          },
          async revokeToken({ expiresAt }) {
            revokedTokens.set(name, expiresAt);
          },
          async isTokenRevoked() {
            return (revokedTokens.get(name) || 0) > Math.floor(Date.now() / 1000);
          }
        };
      }
    };
    const authSecurityStore = await import('../authSecurityStore.js');

    await expect(authSecurityStore.initializeAuthSecurityStore({ rateLimiter })).resolves.toBe('cloudflare');
    await expect(
      authSecurityStore.consumeAuthRateLimit({
        scope: 'login',
        key: 'client',
        limit: 2,
        windowMs: 60_000,
        cost: 2
      })
    ).resolves.toEqual({ allowed: true, retryAfterSeconds: 0 });
    await expect(
      authSecurityStore.consumeAuthRateLimit({
        scope: 'login',
        key: 'client',
        limit: 2,
        windowMs: 60_000,
        cost: 1
      })
    ).resolves.toMatchObject({ allowed: false });

    await authSecurityStore.revokeAuthToken('token-1', Math.floor(Date.now() / 1000) + 3600);
    await expect(authSecurityStore.checkRevokedToken('token-1')).resolves.toBe(true);
    expect(objectNames).toHaveLength(4);
    expect(objectNames[0]).toBe(objectNames[1]);
    expect(objectNames[2]).toBe(objectNames[3]);
    expect(objectNames[0]).not.toBe(objectNames[2]);
    expect(objectNames).toEqual(expect.arrayContaining([expect.stringMatching(/^[a-f0-9]{64}$/)]));
  }, 15_000);

  it('enforces weighted limits without charging a rejected memory-store request', async () => {
    const authSecurityStore = await import('../authSecurityStore.js');
    authSecurityStore.resetAuthSecurityStoreForTests();
    const options = {
      scope: 'import-embedding-user-minute',
      key: 'user:user-1',
      limit: 30,
      windowMs: 60_000
    };

    await expect(
      authSecurityStore.consumeAuthRateLimit({ ...options, cost: 29 })
    ).resolves.toMatchObject({ allowed: true });
    await expect(
      authSecurityStore.consumeAuthRateLimit({ ...options, cost: 2 })
    ).resolves.toMatchObject({ allowed: false });
    await expect(
      authSecurityStore.consumeAuthRateLimit({ ...options, cost: 1 })
    ).resolves.toMatchObject({ allowed: true });
    await expect(
      authSecurityStore.consumeAuthRateLimit({ ...options, cost: 1 })
    ).resolves.toMatchObject({ allowed: false });
  });

  it('requires the strongly consistent Cloudflare auth binding', async () => {
    const authSecurityStore = await import('../authSecurityStore.js');

    await expect(
      authSecurityStore.initializeAuthSecurityStore({ requireDistributed: true })
    ).rejects.toThrow('AUTH_RATE_LIMITER');
    await expect(authSecurityStore.initializeAuthSecurityStore({ kv: {} })).rejects.toThrow(
      'AUTH_RATE_LIMITER'
    );
  });

  it('fails closed when the persistent rate limit operation fails', async () => {
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
    ).rejects.toThrow('redis down');

    expect(authSecurityStore.getAuthSecurityStoreMode()).toBe('redis');
  });

  it('fails closed when token revocation checks fail', async () => {
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

    await expect(
      authSecurityStore.revokeAuthToken('token-1', Math.floor(Date.now() / 1000) + 3600)
    ).rejects.toThrow('redis down');
    await expect(authSecurityStore.checkRevokedToken('token-1')).rejects.toThrow('redis down');
    expect(authSecurityStore.getAuthSecurityStoreMode()).toBe('redis');
  });
});
