import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, KEY_LENGTH);
  return `${salt}:${Buffer.from(derivedKey).toString('hex')}`;
}

export async function verifyPassword(password, passwordHash) {
  const [salt, expectedKeyHex] = String(passwordHash || '').split(':');

  if (!salt || !expectedKeyHex) {
    return false;
  }

  const derivedKey = await scrypt(password, salt, KEY_LENGTH);
  const expectedKey = Buffer.from(expectedKeyHex, 'hex');
  const actualKey = Buffer.from(derivedKey);

  if (expectedKey.length !== actualKey.length) {
    return false;
  }

  return timingSafeEqual(expectedKey, actualKey);
}
