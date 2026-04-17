import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1
};
const KEY_LENGTH = 64;
const PASSWORD_HASH_VERSION = 'scrypt$v1';

async function deriveKey(password, salt) {
  return scrypt(password, salt, KEY_LENGTH, SCRYPT_PARAMS);
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await deriveKey(password, salt);
  return `${PASSWORD_HASH_VERSION}$N=${SCRYPT_PARAMS.N},r=${SCRYPT_PARAMS.r},p=${SCRYPT_PARAMS.p}$${salt}$${Buffer.from(
    derivedKey
  ).toString('hex')}`;
}

function parsePasswordHash(passwordHash) {
  const normalizedHash = String(passwordHash || '');

  if (normalizedHash.startsWith(`${PASSWORD_HASH_VERSION}$`)) {
    const [, , , salt, expectedKeyHex] = normalizedHash.split('$');
    return {
      salt,
      expectedKeyHex,
      needsRehash: false
    };
  }

  const [salt, expectedKeyHex] = normalizedHash.split(':');

  return {
    salt,
    expectedKeyHex,
    needsRehash: Boolean(salt && expectedKeyHex)
  };
}

export async function verifyPassword(password, passwordHash) {
  const { salt, expectedKeyHex, needsRehash } = parsePasswordHash(passwordHash);

  if (!salt || !expectedKeyHex) {
    return {
      matches: false,
      needsRehash: false
    };
  }

  const derivedKey = await deriveKey(password, salt);
  const expectedKey = Buffer.from(expectedKeyHex, 'hex');
  const actualKey = Buffer.from(derivedKey);

  if (expectedKey.length !== actualKey.length) {
    return {
      matches: false,
      needsRehash: false
    };
  }

  return {
    matches: timingSafeEqual(expectedKey, actualKey),
    needsRehash
  };
}
