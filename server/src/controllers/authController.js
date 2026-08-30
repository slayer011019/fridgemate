import { clearAuthCookies, getAccessTokenFromRequest, getRefreshTokenFromRequest, setAuthCookies } from '../lib/cookies.js';
import { verifyAccessToken } from '../lib/token.js';
import { serverConfig } from '../config.js';
import { getCurrentUser, loginUser, logoutUser, refreshUserSession, signupUser } from '../services/authService.js';
import { revokeToken } from '../middleware/revokedTokenStore.js';

export async function signupHandler(request, response, next) {
  try {
    const session = await signupUser(request.body);
    setAuthCookies(response, session.accessToken, session.refreshToken);
    response.status(201).json({
      user: session.user
    });
  } catch (error) {
    next(error);
  }
}

export async function loginHandler(request, response, next) {
  try {
    const session = await loginUser(request.body);
    setAuthCookies(response, session.accessToken, session.refreshToken);
    response.json({
      user: session.user
    });
  } catch (error) {
    next(error);
  }
}

export async function refreshSessionHandler(request, response, next) {
  try {
    const session = await refreshUserSession(getRefreshTokenFromRequest(request));
    setAuthCookies(response, session.accessToken, session.refreshToken);
    response.json({
      user: session.user
    });
  } catch (error) {
    clearAuthCookies(response);
    next(error);
  }
}

export async function getCurrentUserHandler(request, response, next) {
  try {
    const user = await getCurrentUser(request.auth.userId);
    response.json(user);
  } catch (error) {
    next(error);
  }
}

export async function logoutHandler(request, response, next) {
  clearAuthCookies(response);

  try {
    const accessToken = getAccessTokenFromRequest(request);
    const accessPayload = accessToken
      ? verifyAccessToken(accessToken, {
          secret: serverConfig.jwtSecret,
          issuer: serverConfig.jwtIssuer,
          audience: serverConfig.jwtAudience
        })
      : null;

    const revocationOperations = [logoutUser(getRefreshTokenFromRequest(request))];

    if (accessPayload?.jti && accessPayload?.exp) {
      revocationOperations.push(revokeToken(accessPayload.jti, accessPayload.exp));
    }

    const revocationResults = await Promise.allSettled(revocationOperations);
    const failedRevocation = revocationResults.find((result) => result.status === 'rejected');

    if (failedRevocation) {
      throw failedRevocation.reason;
    }

    response.status(204).send();
  } catch (error) {
    next(error);
  }
}
