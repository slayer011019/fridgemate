import { describe, expect, it } from 'vitest';
import { assertValidLoginInput, assertValidSignupInput, normalizeAuthInput } from '../authValidation.js';

describe('authValidation', () => {
  it('normalizes email input before validation', () => {
    expect(
      normalizeAuthInput({
        email: '  USER@Example.COM  ',
        password: 'StrongPassphrase123!'
      })
    ).toEqual({
      email: 'user@example.com',
      password: 'StrongPassphrase123!'
    });
  });

  it('rejects signup passwords shorter than 8 characters', () => {
    expect(() =>
      assertValidSignupInput({
        email: 'user@example.com',
        password: 'Ab1!xyz'
      })
    ).toThrow('Password must be at least 8 characters long.');
  });

  it('rejects signup passwords longer than 128 characters', () => {
    expect(() =>
      assertValidSignupInput({
        email: 'user@example.com',
        password: 'a'.repeat(129)
      })
    ).toThrow('Password must be at most 128 characters long.');
  });

  it('rejects signup passwords without a special character', () => {
    expect(() =>
      assertValidSignupInput({
        email: 'user@example.com',
        password: 'Abcdef12'
      })
    ).toThrow('Password must include at least one special character.');
  });

  it('rejects passwords containing the email local part', () => {
    expect(() =>
      assertValidSignupInput({
        email: 'chef@example.com',
        password: 'MyChefPassphrase123!'
      })
    ).toThrow('Password must not contain your email name.');
  });

  it('rejects common password patterns', () => {
    expect(() =>
      assertValidSignupInput({
        email: 'user@example.com',
        password: 'Password123!'
      })
    ).toThrow('Password is too easy to guess. Choose a stronger password.');
  });

  it('rejects oversized login credentials', () => {
    expect(() =>
      assertValidLoginInput({
        email: `${'a'.repeat(255)}@example.com`,
        password: 'StrongPassphrase123!'
      })
    ).toThrow('Email address is too long.');

    expect(() =>
      assertValidLoginInput({
        email: 'user@example.com',
        password: 'a'.repeat(129)
      })
    ).toThrow('Password is too long.');
  });
});
