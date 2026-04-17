import { createHttpError } from '../lib/httpError.js';
import { getAccessTokenFromRequest } from '../lib/cookies.js';
import { verifyAccessToken } from '../lib/token.js';
import { serverConfig } from '../config.js';
import { isTokenRevoked } from './revokedTokenStore.js';

export async function requireAuth(request, _response, next) {
  const authHeader = request.headers.authorization || '';
  const [scheme, bearerToken] = authHeader.split(' ');
  const token = scheme === 'Bearer' && bearerToken ? bearerToken : getAccessTokenFromRequest(request);

  if (!token) {
    next(createHttpError(401, 'Authentication is required.'));
    return;
  }

  const payload = verifyAccessToken(token, {
    secret: serverConfig.jwtSecret,
    issuer: serverConfig.jwtIssuer,
    audience: serverConfig.jwtAudience
  });

  if (!payload?.sub || !payload?.email || !payload?.jti || !payload?.exp) {
    next(createHttpError(401, 'Invalid or expired access token.'));
    return;
  }

  if (await isTokenRevoked(payload.jti)) {
    next(createHttpError(401, 'Invalid or expired access token.'));
    return;
  }

  request.auth = {
    userId: payload.sub,
    email: payload.email,
    jti: payload.jti,
    exp: payload.exp
  };

  next();
}
