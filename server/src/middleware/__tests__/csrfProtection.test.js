import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureServerRuntime } from '../../config.js';
import { csrfProtection } from '../csrfProtection.js';

function createRequest({ method = 'POST', cookie = '', origin = '', referer = '' } = {}) {
  const headers = { cookie, origin, referer };

  return {
    method,
    headers,
    get(name) {
      return headers[name.toLowerCase()] || '';
    }
  };
}

describe('csrfProtection', () => {
  beforeEach(() => {
    configureServerRuntime({
      ALLOWED_ORIGINS: 'https://app.example.com',
      ACCESS_TOKEN_COOKIE_NAME: 'access',
      REFRESH_TOKEN_COOKIE_NAME: 'refresh'
    });
  });

  it('allows safe requests with an auth cookie', () => {
    const next = vi.fn();

    csrfProtection(createRequest({ method: 'GET', cookie: 'access=token' }), {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('allows unsafe requests that do not use auth cookies', () => {
    const next = vi.fn();

    csrfProtection(createRequest({ origin: 'https://attacker.example' }), {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('allows an access-cookie request from an allowed Origin', () => {
    const next = vi.fn();

    csrfProtection(
      createRequest({ cookie: 'access=token', origin: 'https://app.example.com' }),
      {},
      next
    );

    expect(next).toHaveBeenCalledWith();
  });

  it('falls back to an allowed Referer origin for refresh-cookie requests', () => {
    const next = vi.fn();

    csrfProtection(
      createRequest({ cookie: 'refresh=token', referer: 'https://app.example.com/account' }),
      {},
      next
    );

    expect(next).toHaveBeenCalledWith();
  });

  it.each([
    { label: 'a disallowed Origin', origin: 'https://attacker.example' },
    { label: 'a null Origin', origin: 'null' },
    { label: 'no source headers' },
    { label: 'an invalid Referer', referer: 'not-a-url' }
  ])('rejects an auth-cookie request with $label', ({ origin, referer }) => {
    const next = vi.fn();

    csrfProtection(createRequest({ cookie: 'access=token', origin, referer }), {}, next);

    const [error] = next.mock.calls[0];
    expect(error.status).toBe(403);
    expect(error.message).toBe('Request origin is not allowed.');
  });
});
