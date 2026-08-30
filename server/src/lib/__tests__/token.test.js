import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAccessToken, parseExpirySeconds, verifyAccessToken } from '../token.js';

const VERIFICATION_OPTIONS = {
  secret: 'test-secret',
  issuer: 'fridgemate-api',
  audience: 'fridgemate-client'
};

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function createSignedToken({
  header = { alg: 'HS256', typ: 'JWT' },
  payload,
  secret = VERIFICATION_OPTIONS.secret,
  extraSegment = ''
}) {
  const unsignedToken = `${encodeJson(header)}.${encodeJson(payload)}`;
  const signature = createHmac('sha256', secret).update(unsignedToken).digest('base64url');
  return `${unsignedToken}.${signature}${extraSegment ? `.${extraSegment}` : ''}`;
}

describe('token helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('parses only explicit positive duration values', () => {
    expect(parseExpirySeconds('15m')).toBe(15 * 60);
    expect(parseExpirySeconds('12h')).toBe(12 * 60 * 60);
    expect(parseExpirySeconds('30d')).toBe(30 * 24 * 60 * 60);
  });

  it.each([
    undefined,
    null,
    '',
    '15',
    '15 minutes',
    '1.5h',
    '-1h',
    '0s',
    '999999999999999999d'
  ])('rejects malformed expiry %j instead of silently using a fallback', (value) => {
    expect(() => parseExpirySeconds(value)).toThrow(/Token expiry/);
  });

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

    vi.setSystemTime(new Date('2026-04-17T12:00:00.000Z'));
    expect(
      verifyAccessToken(token, {
        secret: 'test-secret',
        issuer: 'fridgemate-api',
        audience: 'fridgemate-client'
      })
    ).toBeNull();
  });

  it.each([
    { alg: 'none', typ: 'JWT' },
    { alg: 'HS512', typ: 'JWT' },
    { alg: 'HS256' },
    { alg: 'HS256', typ: 'NOT-JWT' },
    { alg: 'HS256', typ: 'JWT', crit: ['custom'] },
    { alg: 'HS256', typ: 'JWT', b64: false }
  ])('rejects a signed token with an unsupported JOSE header: %j', (header) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-17T00:00:00.000Z'));
    const now = Math.floor(Date.now() / 1000);
    const token = createSignedToken({
      header,
      payload: {
        sub: 'user-1',
        email: 'user@example.com',
        jti: 'token-1',
        iss: VERIFICATION_OPTIONS.issuer,
        aud: VERIFICATION_OPTIONS.audience,
        iat: now,
        exp: now + 900
      }
    });

    expect(verifyAccessToken(token, VERIFICATION_OPTIONS)).toBeNull();
  });

  it.each([
    ['missing exp', { exp: undefined }],
    ['string exp', { exp: '1776384900' }],
    ['fractional exp', { exp: 1_776_384_900.5 }],
    ['expired exp', { exp: 1_776_384_000 }],
    ['missing iat', { iat: undefined }],
    ['string iat', { iat: '1776384000' }],
    ['future iat', { iat: 1_776_384_061 }],
    ['iat at exp', { iat: 1_776_384_900, exp: 1_776_384_900 }],
    ['string nbf', { nbf: '1776384000' }],
    ['future nbf', { nbf: 1_776_384_061 }],
    ['nbf at exp', { nbf: 1_776_384_900 }]
  ])('rejects a signed token with %s', (_label, overrides) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-17T00:00:00.000Z'));
    const token = createSignedToken({
      payload: {
        sub: 'user-1',
        email: 'user@example.com',
        jti: 'token-1',
        iss: VERIFICATION_OPTIONS.issuer,
        aud: VERIFICATION_OPTIONS.audience,
        iat: 1_776_384_000,
        exp: 1_776_384_900,
        ...overrides
      }
    });

    expect(verifyAccessToken(token, VERIFICATION_OPTIONS)).toBeNull();
  });

  it('rejects non-object claims, non-canonical segments, and extra compact segments', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-17T00:00:00.000Z'));
    const validPayload = {
      sub: 'user-1',
      email: 'user@example.com',
      jti: 'token-1',
      iss: VERIFICATION_OPTIONS.issuer,
      aud: VERIFICATION_OPTIONS.audience,
      iat: 1_776_384_000,
      exp: 1_776_384_900
    };
    const arrayToken = createSignedToken({ payload: [validPayload] });
    const extraSegmentToken = createSignedToken({ payload: validPayload, extraSegment: 'extra' });
    const [header, body] = createSignedToken({ payload: validPayload }).split('.');
    const paddedUnsignedToken = `${header}=.${body}`;
    const paddedSignature = createHmac('sha256', VERIFICATION_OPTIONS.secret)
      .update(paddedUnsignedToken)
      .digest('base64url');

    expect(verifyAccessToken(arrayToken, VERIFICATION_OPTIONS)).toBeNull();
    expect(verifyAccessToken(extraSegmentToken, VERIFICATION_OPTIONS)).toBeNull();
    expect(
      verifyAccessToken(`${paddedUnsignedToken}.${paddedSignature}`, VERIFICATION_OPTIONS)
    ).toBeNull();
  });
});
