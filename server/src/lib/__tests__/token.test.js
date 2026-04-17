import { describe, expect, it, vi } from 'vitest';
import { createAccessToken, verifyAccessToken } from '../token.js';

describe('token helpers', () => {
  it('embeds issuer and audience and validates them on read', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-17T00:00:00.000Z'));

    const token = createAccessToken(
      {
        sub: 'user-1',
        email: 'user@example.com',
        jti: 'token-1'
      },
      {
        secret: 'test-secret',
        expiresIn: '12h',
        issuer: 'fridgemate-api',
        audience: 'fridgemate-client'
      }
    );

    expect(
      verifyAccessToken(token, {
        secret: 'test-secret',
        issuer: 'fridgemate-api',
        audience: 'fridgemate-client'
      })
    ).toMatchObject({
      sub: 'user-1',
      email: 'user@example.com',
      jti: 'token-1',
      iss: 'fridgemate-api',
      aud: 'fridgemate-client'
    });

    expect(
      verifyAccessToken(token, {
        secret: 'test-secret',
        issuer: 'wrong-issuer',
        audience: 'fridgemate-client'
      })
    ).toBeNull();

    vi.useRealTimers();
  });
});
