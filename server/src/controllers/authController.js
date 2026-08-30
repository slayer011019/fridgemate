import {
  clearAuthCookies,
  getAccessTokenFromRequest,
  getBearerAccessTokenFromRequest,
  getRefreshTokenFromRequest,
  setAuthCookies
} from '../lib/cookies.js';
import { recordAccountDeletionRevocationFailure } from '../lib/operationalTelemetry.js';
import { verifyAccessToken } from '../lib/token.js';
import { serverConfig } from '../config.js';
import {
  deleteUserAccount,
  exportUserData,
  getCurrentUser,
  loginUser,
  logoutUser,
  refreshUserSession,
  signupUser
} from '../services/authService.js';
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
    if (error?.status === 429 && Number.isFinite(error.retryAfterSeconds)) {
      response.setHeader('Retry-After', String(Math.max(1, Math.ceil(error.retryAfterSeconds))));
    }

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

export async function exportUserDataHandler(request, response, next) {
  try {
    const exportData = await exportUserData(request.auth.userId, request.body?.password);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="fridgemate-data-${new Date().toISOString().slice(0, 10)}.json"`
    );
    response.json(exportData);
  } catch (error) {
    if (error?.status === 429 && Number.isFinite(error.retryAfterSeconds)) {
      response.setHeader('Retry-After', String(Math.max(1, Math.ceil(error.retryAfterSeconds))));
    }

    next(error);
  }
}

export async function deleteUserAccountHandler(request, response, next) {
  try {
    await deleteUserAccount(request.auth.userId, request.body?.password);
    clearAuthCookies(response);

    try {
      await revokeToken(request.auth.jti, request.auth.exp);
    } catch (revocationError) {
      recordAccountDeletionRevocationFailure(revocationError);
    }

    response.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function logoutHandler(request, response, next) {
  clearAuthCookies(response);

  try {
    const revocationOperations = [logoutUser(getRefreshTokenFromRequest(request))];
    const verifiedAccessPayloads = [
      getAccessTokenFromRequest(request),
      getBearerAccessTokenFromRequest(request)
    ].map((accessToken) =>
      verifyAccessToken(accessToken, {
        secret: serverConfig.jwtSecret,
        issuer: serverConfig.jwtIssuer,
        audience: serverConfig.jwtAudience
      })
    );
    const accessRevocations = new Map();

    for (const accessPayload of verifiedAccessPayloads) {
      if (
        typeof accessPayload?.jti === 'string' &&
        accessPayload.jti &&
        Number.isSafeInteger(accessPayload.exp)
      ) {
        accessRevocations.set(accessPayload.jti, accessPayload.exp);
      }
    }

    for (const [jti, exp] of accessRevocations) {
      revocationOperations.push(revokeToken(jti, exp));
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
