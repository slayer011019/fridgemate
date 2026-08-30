import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureServerRuntime } from '../../config.js';
import { createAccessToken } from '../../lib/token.js';

const serviceMocks = vi.hoisted(() => ({
  logoutUser: vi.fn()
}));

const revocationMocks = vi.hoisted(() => ({
  revokeToken: vi.fn()
}));

vi.mock('../../services/authService.js', () => ({
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
    send: vi.fn(),
    setHeader(name, value) {
      this.headers[name] = value;
    }
  };

  response.status = vi.fn(() => response);
  return response;
}

describe('authController logoutHandler', () => {
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
});
