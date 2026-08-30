import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureServerRuntime } from '../../config.js';
import { createAccessToken } from '../../lib/token.js';

const serviceMocks = vi.hoisted(() => ({
  deleteUserAccount: vi.fn(),
  exportUserData: vi.fn(),
  logoutUser: vi.fn()
}));

const revocationMocks = vi.hoisted(() => ({
  revokeToken: vi.fn()
}));

vi.mock('../../services/authService.js', () => ({
  deleteUserAccount: serviceMocks.deleteUserAccount,
  exportUserData: serviceMocks.exportUserData,
  getCurrentUser: vi.fn(),
  loginUser: vi.fn(),
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
    revocationMocks.revokeToken.mockResolvedValue(undefined);
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

  it('exports only the service-produced user archive as an attachment', async () => {
    const response = createResponse();
    const next = vi.fn();
    const request = { auth: { userId: 'user-1' } };
    const { exportUserDataHandler } = await import('../authController.js');

    await exportUserDataHandler(request, response, next);

    expect(serviceMocks.exportUserData).toHaveBeenCalledWith('user-1');
    expect(response.headers['Content-Disposition']).toMatch(/^attachment; filename="fridgemate-data-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(response.json).toHaveBeenCalledWith({ schemaVersion: 1 });
    expect(next).not.toHaveBeenCalled();
  });

  it('expires cookies only after password-confirmed account deletion succeeds', async () => {
    const response = createResponse();
    const next = vi.fn();
    const request = {
      auth: { userId: 'user-1' },
      body: { password: 'StrongPassphrase123!' }
    };
    const { deleteUserAccountHandler } = await import('../authController.js');

    await deleteUserAccountHandler(request, response, next);

    expect(serviceMocks.deleteUserAccount).toHaveBeenCalledWith('user-1', 'StrongPassphrase123!');
    expect(response.headers['Set-Cookie']).toHaveLength(4);
    expect(response.status).toHaveBeenCalledWith(204);
    expect(response.send).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
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
