import { getAccessTokenFromRequest } from '../lib/cookies.js';
import { verifyAccessToken } from '../lib/token.js';
import { serverConfig } from '../config.js';
import { isTokenRevoked } from './revokedTokenStore.js';

export async function optionalAuth(request, _response, next) {
  const authHeader = request.headers.authorization || '';
  const [scheme, bearerToken] = authHeader.split(' ');
  const token = scheme === 'Bearer' && bearerToken ? bearerToken : getAccessTokenFromRequest(request);

  if (!token) {
    next();
    return;
  }

  try {
    const payload = verifyAccessToken(token, {
      secret: serverConfig.jwtSecret,
      issuer: serverConfig.jwtIssuer,
      audience: serverConfig.jwtAudience
    });

    if (payload?.sub && payload?.email && payload?.jti && payload?.exp && !(await isTokenRevoked(payload.jti))) {
      request.auth = {
        userId: payload.sub,
        email: payload.email,
        jti: payload.jti,
        exp: payload.exp
      };
    }
  } catch (_error) {
    request.auth = null;
  }

  next();
}
