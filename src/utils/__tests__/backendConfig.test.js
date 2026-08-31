import { describe, expect, it } from 'vitest';
import { resolveApiBaseUrl, resolvePublicSignupEnabled } from '../backendConfig.js';

describe('resolveApiBaseUrl', () => {
  it('disables the production backend on Vercel system and preview hosts', () => {
    expect(
      resolveApiBaseUrl(
        'https://api.xn--wh1bs8l5xa003adme.com/api',
        'fridgemate-git-feature-team.vercel.app'
      )
    ).toBe('');
  });

  it('uses the canonical API only on canonical production hosts', () => {
    expect(resolveApiBaseUrl('', 'xn--wh1bs8l5xa003adme.com')).toBe(
      'https://api.xn--wh1bs8l5xa003adme.com/api'
    );
    expect(resolveApiBaseUrl('', 'localhost')).toBe('');
  });

  it('preserves explicit local and staging backend configuration', () => {
    expect(resolveApiBaseUrl('http://127.0.0.1:4000/api/', 'localhost')).toBe(
      'http://127.0.0.1:4000/api'
    );
  });
});

describe('resolvePublicSignupEnabled', () => {
  it('fails closed in production unless explicitly enabled', () => {
    expect(resolvePublicSignupEnabled(undefined, true)).toBe(false);
    expect(resolvePublicSignupEnabled('1', true)).toBe(false);
    expect(resolvePublicSignupEnabled('true', true)).toBe(true);
  });

  it('keeps local development signup available by default', () => {
    expect(resolvePublicSignupEnabled(undefined, false)).toBe(true);
  });
});
