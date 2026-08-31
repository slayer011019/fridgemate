import { scryptSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../password.js';

const PASSWORD = 'StrongPassphrase123!';
const SALT = '00112233445566778899aabbccddeeff';
const KEY_LENGTH = 64;

function createVersionedHash(password, params) {
  const derivedKey = scryptSync(password, SALT, KEY_LENGTH, params).toString('hex');
  return `scrypt$v1$N=${params.N},r=${params.r},p=${params.p}$${SALT}$${derivedKey}`;
}

describe('password helpers', () => {
  it('stores passwords with the current OWASP-listed scrypt work factors', async () => {
    const passwordHash = await hashPassword(PASSWORD);

    expect(passwordHash).toMatch(
      /^scrypt\$v1\$N=16384,r=8,p=5\$[0-9a-f]{32}\$[0-9a-f]{128}$/
    );
    await expect(verifyPassword(PASSWORD, passwordHash)).resolves.toEqual({
      matches: true,
      needsRehash: false
    });
  });

  it('uses all stored scrypt parameters when verifying a versioned hash', async () => {
    const params = { N: 8192, r: 4, p: 2 };
    const passwordHash = createVersionedHash(PASSWORD, params);

    await expect(verifyPassword(PASSWORD, passwordHash)).resolves.toEqual({
      matches: true,
      needsRehash: true
    });
  });

  it('accepts the previously shipped versioned profile and requests rehashing', async () => {
    const passwordHash = createVersionedHash(PASSWORD, {
      N: 16384,
      r: 8,
      p: 1
    });

    await expect(verifyPassword(PASSWORD, passwordHash)).resolves.toEqual({
      matches: true,
      needsRehash: true
    });
  });

  it('accepts legacy salt:hash values and requests rehashing', async () => {
    const derivedKey = scryptSync(PASSWORD, SALT, KEY_LENGTH, {
      N: 16384,
      r: 8,
      p: 1
    }).toString('hex');
    const legacyHash = `${SALT}:${derivedKey}`;

    await expect(verifyPassword(PASSWORD, legacyHash)).resolves.toEqual({
      matches: true,
      needsRehash: true
    });
  });

  it('rejects the wrong password without requesting a rehash', async () => {
    const passwordHash = createVersionedHash(PASSWORD, {
      N: 16384,
      r: 8,
      p: 1
    });

    await expect(verifyPassword('WrongPassphrase123!', passwordHash)).resolves.toEqual({
      matches: false,
      needsRehash: false
    });
  });

  it('fails safely for malformed hashes and unsafe work factors', async () => {
    const key = '00'.repeat(KEY_LENGTH);
    const suffix = `$${SALT}$${key}`;
    const invalidHashes = [
      null,
      '',
      'not-a-password-hash',
      `scrypt$v2$N=16384,r=8,p=5${suffix}`,
      `scrypt$v1$N=16384,r=8${suffix}`,
      `scrypt$v1$N=16384,p=5,r=8${suffix}`,
      `scrypt$v1$N=3,r=8,p=5${suffix}`,
      `scrypt$v1$N=1073741824,r=8,p=1${suffix}`,
      `scrypt$v1$N=16384,r=1073741824,p=1${suffix}`,
      `scrypt$v1$N=16384,r=8,p=1073741824${suffix}`,
      `scrypt$v1$N=32768,r=16,p=1${suffix}`,
      `scrypt$v1$N=16384,r=8,p=11${suffix}`,
      `scrypt$v1$N=16384,r=8,p=5$not-hex$${key}`,
      `scrypt$v1$N=16384,r=8,p=5$${SALT}$00`,
      `${SALT}:not-hex`,
      `${SALT}:${key}:extra`
    ];

    for (const passwordHash of invalidHashes) {
      await expect(verifyPassword(PASSWORD, passwordHash)).resolves.toEqual({
        matches: false,
        needsRehash: false
      });
    }
  });
});
