import { createHmac, timingSafeEqual } from 'node:crypto';

function parseExpirySeconds(value) {
  const normalized = String(value || '7d').trim();
  const match = normalized.match(/^(\d+)([smhd])$/i);

  if (!match) {
    return 7 * 24 * 60 * 60;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's':
      return amount;
    case 'm':
      return amount * 60;
    case 'h':
      return amount * 60 * 60;
    case 'd':
    default:
      return amount * 24 * 60 * 60;
  }
}

function encodeBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function decodeBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(unsignedToken, secret) {
  return createHmac('sha256', secret).update(unsignedToken).digest('base64url');
}

export function createAccessToken(payload, { secret, expiresIn }) {
  const now = Math.floor(Date.now() / 1000);
  const expirationSeconds = parseExpirySeconds(expiresIn);
  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = encodeBase64Url(
    JSON.stringify({
      ...payload,
      iat: now,
      exp: now + expirationSeconds
    })
  );
  const unsignedToken = `${header}.${body}`;
  const signature = sign(unsignedToken, secret);

  return `${unsignedToken}.${signature}`;
}

export function verifyAccessToken(token, { secret }) {
  const [header, body, signature] = String(token || '').split('.');

  if (!header || !body || !signature) {
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

    if (typeof payload.exp === 'number' && payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
