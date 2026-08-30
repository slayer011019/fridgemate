import { parseExpirySeconds } from './token.js';
import { serverConfig } from '../config.js';

const LEGACY_ACCESS_TOKEN_COOKIE_NAME = 'fridgemate_access';
const LEGACY_REFRESH_TOKEN_COOKIE_NAME = 'fridgemate_refresh';
const MAX_COOKIE_HEADER_LENGTH = 8192;
const MAX_COOKIE_NAME_LENGTH = 256;
const MAX_COOKIE_VALUE_LENGTH = 4096;
const COOKIE_NAME_SPECIAL_CHARACTERS = new Set("!#$%&'*+-.^_`|~");

function isValidCookieName(name) {
  if (!name || name.length > MAX_COOKIE_NAME_LENGTH) return false;

  for (const character of name) {
    const codePoint = character.codePointAt(0);
    const isDigit = codePoint >= 48 && codePoint <= 57;
    const isUppercaseLetter = codePoint >= 65 && codePoint <= 90;
    const isLowercaseLetter = codePoint >= 97 && codePoint <= 122;

    if (!isDigit && !isUppercaseLetter && !isLowercaseLetter && !COOKIE_NAME_SPECIAL_CHARACTERS.has(character)) {
      return false;
    }
  }

  return true;
}

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
  const header = String(headerValue || '');
  if (header.length > MAX_COOKIE_HEADER_LENGTH) return new Map();

  return header
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((cookies, entry) => {
      const separatorIndex = entry.indexOf('=');

      if (separatorIndex === -1) {
        return cookies;
      }

      const name = entry.slice(0, separatorIndex).trim();
      const encodedValue = entry.slice(separatorIndex + 1).trim();
      let value = '';

      if (!isValidCookieName(name) || encodedValue.length > MAX_COOKIE_VALUE_LENGTH) {
        return cookies;
      }

      try {
        value = decodeURIComponent(encodedValue);
      } catch {
        return cookies;
      }

      cookies.set(name, value);

      return cookies;
    }, new Map());
}

export function getCookie(request, name) {
  return parseCookieHeader(request.headers?.cookie).get(name) || '';
}

export function getAccessTokenFromRequest(request) {
  return getCookie(request, serverConfig.accessTokenCookieName);
}

export function getBearerAccessTokenFromRequest(request) {
  const [scheme, token, extra] = String(request.headers?.authorization || '').trim().split(/\s+/);
  return scheme?.toLowerCase() === 'bearer' && token && !extra ? token : '';
}

export function getRequestAccessToken(request) {
  return getBearerAccessTokenFromRequest(request) || getAccessTokenFromRequest(request);
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

  if (serverConfig.accessTokenCookieName !== LEGACY_ACCESS_TOKEN_COOKIE_NAME) {
    cookies.push(serializeExpiredAuthCookie(LEGACY_ACCESS_TOKEN_COOKIE_NAME));
  }

  if (serverConfig.refreshTokenCookieName !== LEGACY_REFRESH_TOKEN_COOKIE_NAME) {
    cookies.push(serializeExpiredAuthCookie(LEGACY_REFRESH_TOKEN_COOKIE_NAME));
  }

  response.setHeader('Set-Cookie', cookies);
}

function serializeExpiredAuthCookie(name) {
  return serializeCookie(name, '', {
    httpOnly: true,
    secure: serverConfig.authCookieSecure,
    sameSite: serverConfig.authCookieSameSite,
    path: '/',
    maxAge: 0
  });
}

export function clearAuthCookies(response) {
  const cookieNames = new Set([
    serverConfig.accessTokenCookieName,
    serverConfig.refreshTokenCookieName,
    LEGACY_ACCESS_TOKEN_COOKIE_NAME,
    LEGACY_REFRESH_TOKEN_COOKIE_NAME
  ]);

  response.setHeader('Set-Cookie', [...cookieNames].map(serializeExpiredAuthCookie));
}
