import { beforeEach, describe, expect, it } from 'vitest';
import { configureServerRuntime } from '../../config.js';
import { clearAuthCookies, setAuthCookies } from '../cookies.js';

function createResponse() {
  return {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    }
  };
}

describe('auth cookie migration', () => {
  beforeEach(() => {
    configureServerRuntime({
      NODE_ENV: 'production',
      AUTH_COOKIE_SECURE: 'true',
      AUTH_COOKIE_SAME_SITE: 'Lax',
      ACCESS_TOKEN_COOKIE_NAME: '__Host-fridgemate_access',
      REFRESH_TOKEN_COOKIE_NAME: '__Host-fridgemate_refresh'
    });
  });

  it('expires legacy cookies when setting the new production cookies', () => {
    const response = createResponse();

    setAuthCookies(response, 'access-token', 'refresh-token');

    expect(response.headers['Set-Cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('__Host-fridgemate_access=access-token'),
        expect.stringContaining('__Host-fridgemate_refresh=refresh-token'),
        expect.stringMatching(/^fridgemate_access=; Max-Age=0;/),
        expect.stringMatching(/^fridgemate_refresh=; Max-Age=0;/)
      ])
    );
  });

  it('clears both current and legacy cookie names after a failed refresh or logout', () => {
    const response = createResponse();

    clearAuthCookies(response);

    expect(response.headers['Set-Cookie']).toHaveLength(4);
    expect(response.headers['Set-Cookie'].every((cookie) => cookie.includes('Max-Age=0'))).toBe(true);
  });
});
