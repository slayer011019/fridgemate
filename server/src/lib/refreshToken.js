import { createHash, randomBytes } from 'node:crypto';

export function createRefreshToken() {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token) {
  return createHash('sha256').update(String(token || '')).digest('hex');
}
