import { describe, expect, it } from 'vitest';
import { createRefreshToken, isValidRefreshToken } from '../refreshToken.js';

describe('refreshToken input boundary', () => {
  it('accepts only the exact token shape issued by the server', () => {
    expect(isValidRefreshToken(createRefreshToken())).toBe(true);
    expect(isValidRefreshToken('a'.repeat(42))).toBe(false);
    expect(isValidRefreshToken('a'.repeat(44))).toBe(false);
    expect(isValidRefreshToken(`${'a'.repeat(42)}!`)).toBe(false);
    expect(isValidRefreshToken(null)).toBe(false);
  });
});
