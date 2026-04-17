import { scryptSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../password.js';

describe('password helpers', () => {
  it('stores passwords in the versioned scrypt format', async () => {
    const passwordHash = await hashPassword('StrongPassphrase123!');

    expect(passwordHash.startsWith('scrypt$v1$')).toBe(true);
    await expect(verifyPassword('StrongPassphrase123!', passwordHash)).resolves.toEqual({
      matches: true,
      needsRehash: false
    });
  });

  it('accepts legacy salt:hash values and requests rehashing', async () => {
    const salt = '00112233445566778899aabbccddeeff';
    const derivedKey = scryptSync('StrongPassphrase123!', salt, 64, {
      N: 16384,
      r: 8,
      p: 1
    }).toString('hex');
    const legacyHash = `${salt}:${derivedKey}`;

    await expect(verifyPassword('StrongPassphrase123!', legacyHash)).resolves.toEqual({
      matches: true,
      needsRehash: true
    });
  });
});
