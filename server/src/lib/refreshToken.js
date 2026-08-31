import { createHash, randomBytes } from 'node:crypto';

const REFRESH_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createRefreshToken() {
  return randomBytes(32).toString('base64url');
}

export function isValidRefreshToken(token) {
  return typeof token === 'string' && REFRESH_TOKEN_PATTERN.test(token);
}

export function hashRefreshToken(token) {
  return createHash('sha256').update(String(token || '')).digest('hex');
}
