import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('requireAuth', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.JWT_SECRET = '12345678901234567890123456789012';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/fridgemate';
    process.env.JWT_ISSUER = 'fridgemate-api';
    process.env.JWT_AUDIENCE = 'fridgemate-client';
    process.env.NODE_ENV = 'test';
  });

  afterEach(async () => {
    const revokedTokenStore = await import('../revokedTokenStore.js');
    revokedTokenStore.clearRevokedTokens();
    vi.useRealTimers();
  });

  it('rejects revoked tokens', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-17T00:00:00.000Z'));
    const tokenModule = await import('../../lib/token.js');
    const revokedTokenStore = await import('../revokedTokenStore.js');
    const { requireAuth } = await import('../requireAuth.js');
    const token = tokenModule.createAccessToken(
      {
        sub: 'user-1',
        email: 'user@example.com',
        jti: 'token-1'
      },
      {
        secret: '12345678901234567890123456789012',
        expiresIn: '12h',
        issuer: 'fridgemate-api',
        audience: 'fridgemate-client'
      }
    );

    await revokedTokenStore.revokeToken('token-1', Math.floor(Date.now() / 1000) + 3600);
    const next = vi.fn();

    await requireAuth(
      {
        headers: {
          authorization: `Bearer ${token}`
        }
      },
      {},
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });
});
