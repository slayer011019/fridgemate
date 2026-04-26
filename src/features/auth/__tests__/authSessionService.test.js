import { beforeEach, describe, expect, it, vi } from 'vitest';

const authApiMocks = {
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn(),
  signup: vi.fn()
};

vi.mock('../../../api/authApi.js', () => ({
  getCurrentUser: (...args) => authApiMocks.getCurrentUser(...args),
  login: (...args) => authApiMocks.login(...args),
  logout: (...args) => authApiMocks.logout(...args),
  refreshSession: (...args) => authApiMocks.refreshSession(...args),
  signup: (...args) => authApiMocks.signup(...args)
}));

describe('authSessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('refreshes a stored session and replaces the stale user', async () => {
    authApiMocks.refreshSession.mockResolvedValue({ user: { id: 'user-1', email: 'fresh@example.com' } });
    window.localStorage.setItem(
      'fridgemate-auth-session',
      JSON.stringify({
        user: { id: 'user-1', email: 'stale@example.com' }
      })
    );

    const { refreshStoredSession } = await import('../authSessionService.js');
    const setSession = vi.fn();
    const setLoading = vi.fn();
    const setError = vi.fn();

    const result = await refreshStoredSession({
      backendEnabled: true,
      setSession,
      setLoading,
      setError
    });

    expect(result).toEqual({
      user: { id: 'user-1', email: 'fresh@example.com' }
    });
    expect(setSession).toHaveBeenLastCalledWith(result);
    expect(setLoading).toHaveBeenCalledWith(true);
    expect(setLoading).toHaveBeenLastCalledWith(false);
    expect(setError).toHaveBeenLastCalledWith('');
  });

  it('clears the session on authorization failure', async () => {
    const authError = new Error('Authentication required');
    authError.status = 401;
    authApiMocks.refreshSession.mockRejectedValue(authError);
    window.localStorage.setItem(
      'fridgemate-auth-session',
      JSON.stringify({
        user: { id: 'user-1', email: 'stale@example.com' }
      })
    );

    const { refreshStoredSession } = await import('../authSessionService.js');
    const setSession = vi.fn();
    const setLoading = vi.fn();
    const setError = vi.fn();

    const result = await refreshStoredSession({
      backendEnabled: true,
      setSession,
      setLoading,
      setError
    });

    expect(result).toBeNull();
    expect(setSession).toHaveBeenLastCalledWith(null);
    expect(setError).toHaveBeenLastCalledWith('Authentication required');
  });

  it('logs in and persists a new session', async () => {
    authApiMocks.login.mockResolvedValue({
      user: { id: 'user-2', email: 'login@example.com' }
    });

    const { loginWithSession } = await import('../authSessionService.js');
    const setSession = vi.fn();
    const setError = vi.fn();

    const result = await loginWithSession(
      { email: 'login@example.com', password: 'pw' },
      {
        backendEnabled: true,
        setSession,
        setError
      }
    );

    expect(result.user.email).toBe('login@example.com');
    expect(setSession).toHaveBeenCalledWith(result);
    expect(setError).toHaveBeenLastCalledWith('');
  });
});
