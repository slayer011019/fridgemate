import { createHttpError } from '../lib/httpError.js';
import { verifyAccessToken } from '../lib/token.js';
import { serverConfig } from '../config.js';

export function requireAuth(request, _response, next) {
  const authHeader = request.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    next(createHttpError(401, 'Authentication is required.'));
    return;
  }

  const payload = verifyAccessToken(token, {
    secret: serverConfig.jwtSecret
  });

  if (!payload?.sub || !payload?.email) {
    next(createHttpError(401, 'Invalid or expired access token.'));
    return;
  }

  request.auth = {
    userId: payload.sub,
    email: payload.email
  };

  next();
}
