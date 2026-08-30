import { createHmac, timingSafeEqual } from 'node:crypto';

const ACCESS_TOKEN_ALGORITHM = 'HS256';
const ACCESS_TOKEN_TYPE = 'JWT';
const MAX_ACCESS_TOKEN_LENGTH = 4096;
const MAX_CLOCK_SKEW_SECONDS = 60;
const BASE64URL_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;

export function parseExpirySeconds(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  const match = normalized.match(/^(\d+)([smhd])$/i);

  if (!match) {
    throw new TypeError(
      'Token expiry must be a positive integer followed by s, m, h, or d.'
    );
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const unitSeconds = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60
  }[unit];
  const seconds = amount * unitSeconds;

  if (amount < 1 || !Number.isSafeInteger(seconds)) {
    throw new TypeError(
      'Token expiry must resolve to a positive, safely representable number of seconds.'
    );
  }

  return seconds;
}

function encodeBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function decodeBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function isCanonicalBase64Url(value) {
  if (!BASE64URL_SEGMENT_PATTERN.test(value)) {
    return false;
  }

  try {
    return Buffer.from(value, 'base64url').toString('base64url') === value;
  } catch {
    return false;
  }
}

function isJsonObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNumericDate(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function sign(unsignedToken, secret) {
  return createHmac('sha256', secret).update(unsignedToken).digest('base64url');
}

export function createAccessToken(payload, { secret, expiresIn, issuer, audience }) {
  const now = Math.floor(Date.now() / 1000);
  const expirationSeconds = parseExpirySeconds(expiresIn);
  const header = encodeBase64Url(
    JSON.stringify({ alg: ACCESS_TOKEN_ALGORITHM, typ: ACCESS_TOKEN_TYPE })
  );
  const body = encodeBase64Url(
    JSON.stringify({
      ...payload,
      iss: issuer,
      aud: audience,
      iat: now,
      exp: now + expirationSeconds
    })
  );
  const unsignedToken = `${header}.${body}`;
  const signature = sign(unsignedToken, secret);

  return `${unsignedToken}.${signature}`;
}

export function verifyAccessToken(token, { secret, issuer, audience }) {
  const normalizedToken = String(token || '');

  if (!normalizedToken || normalizedToken.length > MAX_ACCESS_TOKEN_LENGTH) {
    return null;
  }

  const segments = normalizedToken.split('.');

  if (segments.length !== 3 || segments.some((segment) => !isCanonicalBase64Url(segment))) {
    return null;
  }

  const [header, body, signature] = segments;
  let protectedHeader;

  try {
    protectedHeader = JSON.parse(decodeBase64Url(header));
  } catch {
    return null;
  }

  if (
    !isJsonObject(protectedHeader) ||
    protectedHeader.alg !== ACCESS_TOKEN_ALGORITHM ||
    protectedHeader.typ !== ACCESS_TOKEN_TYPE ||
    protectedHeader.crit !== undefined ||
    protectedHeader.b64 !== undefined
  ) {
    return null;
  }

  const unsignedToken = `${header}.${body}`;
  const expectedSignature = sign(unsignedToken, secret);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(body));
    const now = Math.floor(Date.now() / 1000);

    if (
      !isJsonObject(payload) ||
      !isNumericDate(payload.exp) ||
      !isNumericDate(payload.iat) ||
      payload.exp <= now ||
      payload.iat > now + MAX_CLOCK_SKEW_SECONDS ||
      payload.iat >= payload.exp
    ) {
      return null;
    }

    if (
      payload.nbf !== undefined &&
      (!isNumericDate(payload.nbf) ||
        payload.nbf > now + MAX_CLOCK_SKEW_SECONDS ||
        payload.nbf >= payload.exp)
    ) {
      return null;
    }

    if (issuer && payload.iss !== issuer) {
      return null;
    }

    if (audience && payload.aud !== audience) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
