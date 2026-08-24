import { isAllowedOrigin } from '../config.js';
import { getAccessTokenFromRequest, getRefreshTokenFromRequest } from '../lib/cookies.js';
import { createHttpError } from '../lib/httpError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function getHeader(request, name) {
  return request.get?.(name) || request.headers?.[name.toLowerCase()] || '';
}

function getSourceOrigin(request) {
  const origin = getHeader(request, 'origin');

  if (origin) {
    return origin;
  }

  const referer = getHeader(request, 'referer');

  if (!referer) {
    return '';
  }

  try {
    return new URL(referer).origin;
  } catch {
    return '';
  }
}

export function csrfProtection(request, _response, next) {
  if (SAFE_METHODS.has(String(request.method || '').toUpperCase())) {
    next();
    return;
  }

  const hasAuthCookie = Boolean(
    getAccessTokenFromRequest(request) || getRefreshTokenFromRequest(request)
  );

  if (!hasAuthCookie) {
    next();
    return;
  }

  const sourceOrigin = getSourceOrigin(request);

  if (!sourceOrigin || sourceOrigin === 'null' || !isAllowedOrigin(sourceOrigin)) {
    next(createHttpError(403, 'Request origin is not allowed.'));
    return;
  }

  next();
}
