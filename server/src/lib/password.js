import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const CURRENT_SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 5
};
const LEGACY_SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1
};
const KEY_LENGTH = 64;
const PASSWORD_HASH_VERSION = 'scrypt$v1';
const MAX_PASSWORD_HASH_LENGTH = 256;
const MAX_SCRYPT_N = 32768;
const MAX_SCRYPT_R = 32;
const MAX_SCRYPT_P = 10;
const MAX_SCRYPT_MEMORY_BYTES = 32 * 1024 * 1024;
const MAX_SCRYPT_WORK = CURRENT_SCRYPT_PARAMS.N * CURRENT_SCRYPT_PARAMS.r * 10;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
const VERSIONED_HASH_PATTERN =
  /^scrypt\$v1\$N=([1-9]\d{0,5}),r=([1-9]\d{0,5}),p=([1-9]\d{0,5})\$([0-9a-f]{32})\$([0-9a-f]{128})$/i;
const LEGACY_HASH_PATTERN = /^([0-9a-f]{32}):([0-9a-f]{128})$/i;

async function deriveKey(password, salt, params) {
  return scrypt(password, salt, KEY_LENGTH, {
    ...params,
    maxmem: SCRYPT_MAXMEM
  });
}

function isSafeScryptParams(params) {
  const { N, r, p } = params;

  if (
    !Number.isSafeInteger(N) ||
    !Number.isSafeInteger(r) ||
    !Number.isSafeInteger(p) ||
    N < 2 ||
    N > MAX_SCRYPT_N ||
    r < 1 ||
    r > MAX_SCRYPT_R ||
    p < 1 ||
    p > MAX_SCRYPT_P ||
    !Number.isInteger(Math.log2(N))
  ) {
    return false;
  }

  const memoryCost = 128 * N * r;
  const work = N * r * p;

  return memoryCost <= MAX_SCRYPT_MEMORY_BYTES && work <= MAX_SCRYPT_WORK;
}

function usesCurrentPolicy(params) {
  return (
    params.N === CURRENT_SCRYPT_PARAMS.N &&
    params.r === CURRENT_SCRYPT_PARAMS.r &&
    params.p === CURRENT_SCRYPT_PARAMS.p
  );
}

function parsePasswordHash(passwordHash) {
  if (typeof passwordHash !== 'string' || passwordHash.length > MAX_PASSWORD_HASH_LENGTH) {
    return null;
  }

  const versionedMatch = VERSIONED_HASH_PATTERN.exec(passwordHash);

  if (versionedMatch) {
    const params = {
      N: Number(versionedMatch[1]),
      r: Number(versionedMatch[2]),
      p: Number(versionedMatch[3])
    };

    if (!isSafeScryptParams(params)) {
      return null;
    }

    return {
      params,
      salt: versionedMatch[4],
      expectedKeyHex: versionedMatch[5],
      needsRehash: !usesCurrentPolicy(params)
    };
  }

  const legacyMatch = LEGACY_HASH_PATTERN.exec(passwordHash);

  if (!legacyMatch) {
    return null;
  }

  return {
    params: LEGACY_SCRYPT_PARAMS,
    salt: legacyMatch[1],
    expectedKeyHex: legacyMatch[2],
    needsRehash: true
  };
}

function failedVerification() {
  return {
    matches: false,
    needsRehash: false
  };
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await deriveKey(password, salt, CURRENT_SCRYPT_PARAMS);
  return `${PASSWORD_HASH_VERSION}$N=${CURRENT_SCRYPT_PARAMS.N},r=${CURRENT_SCRYPT_PARAMS.r},p=${CURRENT_SCRYPT_PARAMS.p}$${salt}$${Buffer.from(
    derivedKey
  ).toString('hex')}`;
}

export async function verifyPassword(password, passwordHash) {
  const parsedHash = parsePasswordHash(passwordHash);

  if (!parsedHash) {
    return failedVerification();
  }

  let derivedKey;

  try {
    derivedKey = await deriveKey(password, parsedHash.salt, parsedHash.params);
  } catch {
    return failedVerification();
  }

  const expectedKey = Buffer.from(parsedHash.expectedKeyHex, 'hex');
  const actualKey = Buffer.from(derivedKey);

  if (expectedKey.length !== actualKey.length) {
    return failedVerification();
  }

  const matches = timingSafeEqual(expectedKey, actualKey);

  return {
    matches,
    needsRehash: matches && parsedHash.needsRehash
  };
}
