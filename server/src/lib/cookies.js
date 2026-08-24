import { parseExpirySeconds } from './token.js';
import { serverConfig } from '../config.js';

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  parts.push(`Path=${options.path || '/'}`);

  if (options.httpOnly) {
    parts.push('HttpOnly');
  }

  if (options.secure) {
    parts.push('Secure');
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  return parts.join('; ');
}

export function parseCookieHeader(headerValue) {
  return String(headerValue || '')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((cookies, entry) => {
      const separatorIndex = entry.indexOf('=');

      if (separatorIndex === -1) {
        return cookies;
      }

      const name = entry.slice(0, separatorIndex).trim();
      let value = '';

      try {
        value = decodeURIComponent(entry.slice(separatorIndex + 1).trim());
      } catch {
        return cookies;
      }

      if (name) {
        cookies[name] = value;
      }

      return cookies;
    }, {});
}

export function getCookie(request, name) {
  return parseCookieHeader(request.headers.cookie)[name] || '';
}

export function getAccessTokenFromRequest(request) {
  return getCookie(request, serverConfig.accessTokenCookieName);
}

export function getRefreshTokenFromRequest(request) {
  return getCookie(request, serverConfig.refreshTokenCookieName);
}

export function setAuthCookies(response, accessToken, refreshToken) {
  const cookies = [
    serializeCookie(serverConfig.accessTokenCookieName, accessToken, {
      httpOnly: true,
      secure: serverConfig.authCookieSecure,
      sameSite: serverConfig.authCookieSameSite,
      path: '/',
      maxAge: parseExpirySeconds(serverConfig.jwtExpiresIn)
    }),
    serializeCookie(serverConfig.refreshTokenCookieName, refreshToken, {
      httpOnly: true,
      secure: serverConfig.authCookieSecure,
      sameSite: serverConfig.authCookieSameSite,
      path: '/',
      maxAge: parseExpirySeconds(serverConfig.refreshTokenExpiresIn)
    })
  ];

  response.setHeader('Set-Cookie', cookies);
}

export function clearAuthCookies(response) {
  response.setHeader('Set-Cookie', [
    serializeCookie(serverConfig.accessTokenCookieName, '', {
      httpOnly: true,
      secure: serverConfig.authCookieSecure,
      sameSite: serverConfig.authCookieSameSite,
      path: '/',
      maxAge: 0
    }),
    serializeCookie(serverConfig.refreshTokenCookieName, '', {
      httpOnly: true,
      secure: serverConfig.authCookieSecure,
      sameSite: serverConfig.authCookieSameSite,
      path: '/',
      maxAge: 0
    })
  ]);
}
