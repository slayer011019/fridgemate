import { beforeEach, describe, expect, it } from 'vitest';
import { configureServerRuntime } from '../../config.js';
import {
  clearAuthCookies,
  getBearerAccessTokenFromRequest,
  getCookie,
  getRequestAccessToken,
  parseCookieHeader,
  setAuthCookies
} from '../cookies.js';

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

  it('uses a well-formed bearer token before the cookie token', () => {
    const request = {
      headers: {
        authorization: 'Bearer bearer-token',
        cookie: '__Host-fridgemate_access=cookie-token'
      }
    };

    expect(getBearerAccessTokenFromRequest(request)).toBe('bearer-token');
    expect(getRequestAccessToken(request)).toBe('bearer-token');
    expect(getBearerAccessTokenFromRequest({ headers: { authorization: 'Bearer one extra' } })).toBe('');
  });

  it('parses cookie names into a Map without assigning remote property names onto an object', () => {
    const cookies = parseCookieHeader(
      '__proto__=polluted; constructor=shadowed; safe-cookie=encoded%20value; invalid name=ignored'
    );

    expect(cookies).toBeInstanceOf(Map);
    expect(cookies.get('__proto__')).toBe('polluted');
    expect(cookies.get('constructor')).toBe('shadowed');
    expect(cookies.get('safe-cookie')).toBe('encoded value');
    expect(cookies.has('invalid name')).toBe(false);
    expect(Object.prototype.polluted).toBeUndefined();
    expect(getCookie({ headers: { cookie: 'safe-cookie=token' } }, 'safe-cookie')).toBe('token');
  });

  it('fails closed on oversized or malformed cookie headers', () => {
    expect(parseCookieHeader(`name=${'a'.repeat(8192)}`).size).toBe(0);
    expect(parseCookieHeader('name=%E0%A4%A').size).toBe(0);
  });
});
