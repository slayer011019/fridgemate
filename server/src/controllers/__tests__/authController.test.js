import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureServerRuntime } from '../../config.js';
import { createAccessToken } from '../../lib/token.js';

const serviceMocks = vi.hoisted(() => ({
  deleteUserAccount: vi.fn(),
  exportUserData: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn()
}));

const revocationMocks = vi.hoisted(() => ({
  revokeToken: vi.fn()
}));

vi.mock('../../services/authService.js', () => ({
  deleteUserAccount: serviceMocks.deleteUserAccount,
  exportUserData: serviceMocks.exportUserData,
  getCurrentUser: vi.fn(),
  loginUser: serviceMocks.loginUser,
  logoutUser: serviceMocks.logoutUser,
  refreshUserSession: vi.fn(),
  signupUser: vi.fn()
}));

vi.mock('../../middleware/revokedTokenStore.js', () => ({
  revokeToken: revocationMocks.revokeToken
}));

const TEST_JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters';

function createRequest() {
  const accessToken = createAccessToken(
    { sub: 'user-1', jti: 'access-token-1' },
    {
      secret: TEST_JWT_SECRET,
      expiresIn: '15m',
      issuer: 'fridgemate-api',
      audience: 'fridgemate-client'
    }
  );

  return {
    headers: {
      cookie: `__Host-fridgemate_access=${accessToken}; __Host-fridgemate_refresh=refresh-token-1`
    }
  };
}

function createResponse() {
  const response = {
    headers: {},
    json: vi.fn(),
    send: vi.fn(),
    setHeader(name, value) {
      this.headers[name] = value;
    }
  };

  response.status = vi.fn(() => response);
  return response;
}

describe('authController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureServerRuntime({
      NODE_ENV: 'production',
      JWT_SECRET: TEST_JWT_SECRET,
      JWT_ISSUER: 'fridgemate-api',
      JWT_AUDIENCE: 'fridgemate-client',
      AUTH_COOKIE_SECURE: 'true',
      AUTH_COOKIE_SAME_SITE: 'Lax',
      ACCESS_TOKEN_COOKIE_NAME: '__Host-fridgemate_access',
      REFRESH_TOKEN_COOKIE_NAME: '__Host-fridgemate_refresh'
    });
    serviceMocks.logoutUser.mockResolvedValue(undefined);
    serviceMocks.deleteUserAccount.mockResolvedValue(undefined);
    serviceMocks.exportUserData.mockResolvedValue({ schemaVersion: 1 });
    serviceMocks.loginUser.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 'user-1', email: 'user@example.com' }
    });
    revocationMocks.revokeToken.mockResolvedValue(undefined);
  });

  it('preserves Retry-After when a failed-login account budget is exhausted', async () => {
    const rateLimitError = Object.assign(
      new Error('Too many authentication attempts. Please try again later.'),
      { status: 429, retryAfterSeconds: 3_599.2 }
    );
    serviceMocks.loginUser.mockRejectedValue(rateLimitError);
    const response = createResponse();
    const next = vi.fn();
    const { loginHandler } = await import('../authController.js');

    await loginHandler(
      { body: { email: 'victim@example.com', password: 'WrongPassphrase123!' } },
      response,
      next
    );

    expect(response.headers['Retry-After']).toBe('3600');
    expect(response.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(rateLimitError);
  });

  it('expires current and legacy cookies before reporting a revocation failure', async () => {
    const revocationError = new Error('refresh session store unavailable');
    serviceMocks.logoutUser.mockRejectedValue(revocationError);
    const response = createResponse();
    const next = vi.fn();
    const { logoutHandler } = await import('../authController.js');

    await logoutHandler(createRequest(), response, next);

    expect(response.headers['Set-Cookie']).toHaveLength(4);
    expect(response.headers['Set-Cookie'].every((cookie) => cookie.includes('Max-Age=0'))).toBe(true);
    expect(serviceMocks.logoutUser).toHaveBeenCalledWith('refresh-token-1');
    expect(revocationMocks.revokeToken).toHaveBeenCalledWith('access-token-1', expect.any(Number));
    expect(response.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(revocationError);
  });

  it('returns 204 only after refresh and access-token revocation both finish', async () => {
    let completeAccessRevocation;
    revocationMocks.revokeToken.mockReturnValue(
      new Promise((resolve) => {
        completeAccessRevocation = resolve;
      })
    );
    const response = createResponse();
    const next = vi.fn();
    const { logoutHandler } = await import('../authController.js');

    const logoutPromise = logoutHandler(createRequest(), response, next);
    await Promise.resolve();

    expect(response.status).not.toHaveBeenCalled();

    completeAccessRevocation();
    await logoutPromise;

    expect(response.headers['Set-Cookie']).toHaveLength(4);
    expect(response.headers['Set-Cookie'].every((cookie) => cookie.includes('Max-Age=0'))).toBe(true);
    expect(response.status).toHaveBeenCalledWith(204);
    expect(response.send).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  it('still revokes the refresh session and expires cookies when access-token revocation fails', async () => {
    const revocationError = new Error('access revocation store unavailable');
    revocationMocks.revokeToken.mockRejectedValue(revocationError);
    const response = createResponse();
    const next = vi.fn();
    const { logoutHandler } = await import('../authController.js');

    await logoutHandler(createRequest(), response, next);

    expect(serviceMocks.logoutUser).toHaveBeenCalledWith('refresh-token-1');
    expect(response.headers['Set-Cookie']).toHaveLength(4);
    expect(response.headers['Set-Cookie'].every((cookie) => cookie.includes('Max-Age=0'))).toBe(true);
    expect(response.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(revocationError);
  });

  it('logs out the refresh session even when the access cookie is invalid', async () => {
    const request = {
      headers: {
        cookie: '__Host-fridgemate_access=invalid-token; __Host-fridgemate_refresh=refresh-token-1'
      }
    };
    const response = createResponse();
    const next = vi.fn();
    const { logoutHandler } = await import('../authController.js');

    await logoutHandler(request, response, next);

    expect(serviceMocks.logoutUser).toHaveBeenCalledWith('refresh-token-1');
    expect(revocationMocks.revokeToken).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(204);
    expect(next).not.toHaveBeenCalled();
  });

  it('revokes the bearer access token used for logout', async () => {
    const accessToken = createAccessToken(
      { sub: 'user-1', email: 'user@example.com', jti: 'bearer-access-1' },
      {
        secret: TEST_JWT_SECRET,
        expiresIn: '15m',
        issuer: 'fridgemate-api',
        audience: 'fridgemate-client'
      }
    );
    const response = createResponse();
    const next = vi.fn();
    const { logoutHandler } = await import('../authController.js');

    await logoutHandler(
      {
        headers: {
          authorization: `Bearer ${accessToken}`,
          cookie: '__Host-fridgemate_refresh=refresh-token-1'
        }
      },
      response,
      next
    );

    expect(revocationMocks.revokeToken).toHaveBeenCalledWith('bearer-access-1', expect.any(Number));
    expect(response.status).toHaveBeenCalledWith(204);
    expect(next).not.toHaveBeenCalled();
  });

  it('exports only the service-produced user archive as an attachment', async () => {
    const response = createResponse();
    const next = vi.fn();
    const request = {
      auth: { userId: 'user-1' },
      body: { password: 'StrongPassphrase123!' }
    };
    const { exportUserDataHandler } = await import('../authController.js');

    await exportUserDataHandler(request, response, next);

    expect(serviceMocks.exportUserData).toHaveBeenCalledWith('user-1', 'StrongPassphrase123!');
    expect(response.headers['Content-Disposition']).toMatch(/^attachment; filename="fridgemate-data-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(response.json).toHaveBeenCalledWith({ schemaVersion: 1 });
    expect(next).not.toHaveBeenCalled();
  });

  it('expires cookies only after password-confirmed account deletion succeeds', async () => {
    const response = createResponse();
    const next = vi.fn();
    const request = {
      auth: { userId: 'user-1', jti: 'access-token-1', exp: 2_000_000_000 },
      body: { password: 'StrongPassphrase123!' }
    };
    const { deleteUserAccountHandler } = await import('../authController.js');

    await deleteUserAccountHandler(request, response, next);

    expect(serviceMocks.deleteUserAccount).toHaveBeenCalledWith('user-1', 'StrongPassphrase123!');
    expect(revocationMocks.revokeToken).toHaveBeenCalledWith('access-token-1', 2_000_000_000);
    expect(response.headers['Set-Cookie']).toHaveLength(4);
    expect(response.status).toHaveBeenCalledWith(204);
    expect(response.send).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  it('still returns 204 after committed account deletion when access-token revocation fails', async () => {
    const revocationError = Object.assign(
      new Error('token access-token-1 for user-1 could not be revoked'),
      { code: 'AUTH_STORE_DOWN' }
    );
    revocationMocks.revokeToken.mockRejectedValue(revocationError);
    const warningSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const response = createResponse();
    const next = vi.fn();
    const request = {
      auth: { userId: 'user-1', jti: 'access-token-1', exp: 2_000_000_000 },
      body: { password: 'StrongPassphrase123!' }
    };
    const { deleteUserAccountHandler } = await import('../authController.js');

    try {
      await deleteUserAccountHandler(request, response, next);

      expect(serviceMocks.deleteUserAccount).toHaveBeenCalledWith('user-1', 'StrongPassphrase123!');
      expect(revocationMocks.revokeToken).toHaveBeenCalledWith('access-token-1', 2_000_000_000);
      expect(response.headers['Set-Cookie']).toHaveLength(4);
      expect(response.headers['Set-Cookie'].every((cookie) => cookie.includes('Max-Age=0'))).toBe(true);
      expect(response.status).toHaveBeenCalledWith(204);
      expect(response.send).toHaveBeenCalledTimes(1);
      expect(next).not.toHaveBeenCalled();
      expect(warningSpy).toHaveBeenCalledWith(
        '[server] account deletion revocation failure',
        {
          event: 'account_deletion_revocation_failure',
          errorName: 'Error',
          errorCode: 'AUTH_STORE_DOWN'
        }
      );
      expect(JSON.stringify(warningSpy.mock.calls)).not.toContain('access-token-1');
      expect(JSON.stringify(warningSpy.mock.calls)).not.toContain('user-1');
    } finally {
      warningSpy.mockRestore();
    }
  });

  it('keeps the current cookies when account deletion is rejected', async () => {
    const deletionError = Object.assign(new Error('Current password is incorrect.'), { status: 403 });
    serviceMocks.deleteUserAccount.mockRejectedValue(deletionError);
    const response = createResponse();
    const next = vi.fn();
    const { deleteUserAccountHandler } = await import('../authController.js');

    await deleteUserAccountHandler(
      { auth: { userId: 'user-1' }, body: { password: 'wrong-password' } },
      response,
      next
    );

    expect(response.headers['Set-Cookie']).toBeUndefined();
    expect(response.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(deletionError);
  });
});
