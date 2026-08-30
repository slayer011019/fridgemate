import { beforeEach, describe, expect, it, vi } from 'vitest';

const authApiMocks = {
  deleteAccount: vi.fn(),
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn(),
  signup: vi.fn()
};

const indexedDbMocks = {
  clearIngredients: vi.fn()
};

vi.mock('../../../api/authApi.js', () => ({
  deleteAccount: (...args) => authApiMocks.deleteAccount(...args),
  getCurrentUser: (...args) => authApiMocks.getCurrentUser(...args),
  login: (...args) => authApiMocks.login(...args),
  logout: (...args) => authApiMocks.logout(...args),
  refreshSession: (...args) => authApiMocks.refreshSession(...args),
  signup: (...args) => authApiMocks.signup(...args)
}));

vi.mock('../../../db/indexedDB.js', () => ({
  clearIngredients: (...args) => indexedDbMocks.clearIngredients(...args)
}));

describe('authSessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    indexedDbMocks.clearIngredients.mockResolvedValue(undefined);
  });

  it('restores a server-verified session without persisting identity in localStorage', async () => {
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
    expect(window.localStorage.getItem('fridgemate-auth-session')).toBeNull();
    expect(window.localStorage.getItem('fridgemate-auth-session-present:v1')).toBe('1');
  });

  it('does not refresh when no non-PII session hint exists', async () => {
    const { refreshStoredSession } = await import('../authSessionService.js');
    const setSession = vi.fn();
    const setLoading = vi.fn();
    const setError = vi.fn();

    await expect(
      refreshStoredSession({ backendEnabled: true, setSession, setLoading, setError })
    ).resolves.toBeNull();

    expect(authApiMocks.refreshSession).not.toHaveBeenCalled();
    expect(setSession).toHaveBeenLastCalledWith(null);
  });

  it('fails closed when the server cannot verify the current session', async () => {
    authApiMocks.refreshSession.mockRejectedValue(new Error('API request could not reach the server.'));
    window.localStorage.setItem(
      'fridgemate-auth-session',
      JSON.stringify({ user: { id: 'user-1', email: 'stale@example.com' } })
    );

    const { refreshStoredSession, SESSION_VERIFICATION_FAILED_MESSAGE } = await import('../authSessionService.js');
    const setSession = vi.fn();
    const setLoading = vi.fn();
    const setError = vi.fn();

    await expect(
      refreshStoredSession({ backendEnabled: true, setSession, setLoading, setError })
    ).resolves.toBeNull();

    expect(setSession).toHaveBeenLastCalledWith(null);
    expect(setError).toHaveBeenLastCalledWith(SESSION_VERIFICATION_FAILED_MESSAGE);
    expect(window.localStorage.getItem('fridgemate-auth-session')).toBeNull();
    expect(window.localStorage.getItem('fridgemate-auth-session-present:v1')).toBeNull();
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
    expect(window.localStorage.getItem('fridgemate-auth-session')).toBeNull();
    expect(window.localStorage.getItem('fridgemate-auth-session-present:v1')).toBe('1');
  });

  it('locks the local session and leaves a retry fence when server logout fails', async () => {
    authApiMocks.logout.mockRejectedValue(new Error('network down'));

    const { logoutSession, LOGOUT_PENDING_MESSAGE } = await import('../authSessionService.js');
    const setSession = vi.fn();
    const setGuestImportPrompt = vi.fn();
    const setError = vi.fn();
    const defaultGuestImportPrompt = { available: false, count: 0, loading: false };

    const result = await logoutSession({
      backendEnabled: true,
      setSession,
      setGuestImportPrompt,
      setError,
      defaultGuestImportPrompt
    });

    expect(result).toEqual({ ok: false, pending: true });
    expect(setSession).toHaveBeenLastCalledWith(null);
    expect(setError).toHaveBeenLastCalledWith(LOGOUT_PENDING_MESSAGE);
    expect(window.localStorage.getItem('fridgemate-auth-logout-pending:v1')).toBe('1');
  });

  it('retries a fenced logout before any session refresh', async () => {
    window.localStorage.setItem('fridgemate-auth-logout-pending:v1', '1');
    authApiMocks.logout.mockResolvedValue(null);

    const { refreshStoredSession } = await import('../authSessionService.js');
    const setSession = vi.fn();
    const setLoading = vi.fn();
    const setError = vi.fn();

    await expect(
      refreshStoredSession({ backendEnabled: true, setSession, setLoading, setError })
    ).resolves.toBeNull();

    expect(authApiMocks.logout).toHaveBeenCalledTimes(1);
    expect(authApiMocks.refreshSession).not.toHaveBeenCalled();
    expect(setSession).toHaveBeenLastCalledWith(null);
    expect(window.localStorage.getItem('fridgemate-auth-logout-pending:v1')).toBeNull();
  });

  it('keeps a failed pending logout fenced and never refreshes the old session', async () => {
    window.localStorage.setItem('fridgemate-auth-logout-pending:v1', '1');
    authApiMocks.logout.mockRejectedValue(new Error('network down'));

    const { refreshStoredSession, LOGOUT_PENDING_MESSAGE } = await import('../authSessionService.js');
    const setSession = vi.fn();
    const setLoading = vi.fn();
    const setError = vi.fn();

    await expect(
      refreshStoredSession({ backendEnabled: true, setSession, setLoading, setError })
    ).resolves.toBeNull();

    expect(authApiMocks.refreshSession).not.toHaveBeenCalled();
    expect(setSession).toHaveBeenLastCalledWith(null);
    expect(setError).toHaveBeenLastCalledWith(LOGOUT_PENDING_MESSAGE);
    expect(window.localStorage.getItem('fridgemate-auth-logout-pending:v1')).toBe('1');
  });

  it('locks the local session even when the logout fence cannot be stored', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is unavailable.', 'SecurityError');
    });
    authApiMocks.logout.mockRejectedValue(new Error('network down'));

    try {
      const { logoutSession, LOGOUT_FAILED_MESSAGE } = await import('../authSessionService.js');
      const setSession = vi.fn();
      const setGuestImportPrompt = vi.fn();
      const setError = vi.fn();
      const defaultGuestImportPrompt = { available: false, count: 0, loading: false };

      const result = await logoutSession({
        backendEnabled: true,
        setSession,
        setGuestImportPrompt,
        setError,
        defaultGuestImportPrompt
      });

      expect(result).toEqual({ ok: false, pending: false });
      expect(setSession).toHaveBeenLastCalledWith(null);
      expect(setError).toHaveBeenLastCalledWith(LOGOUT_FAILED_MESSAGE);
    } finally {
      setItemSpy.mockRestore();
    }
  });

  it('clears the account-scoped local cache after server account deletion succeeds', async () => {
    authApiMocks.deleteAccount.mockResolvedValue(null);
    window.localStorage.setItem('fridgemate-auth-session-present:v1', '1');
    window.localStorage.setItem('fridgemate-guest-import:user-1', 'dismissed');
    const { deleteAccountWithSession } = await import('../authSessionService.js');
    const setSession = vi.fn();
    const setGuestImportPrompt = vi.fn();
    const setError = vi.fn();
    const defaultGuestImportPrompt = { available: false, count: 0, loading: false };

    const result = await deleteAccountWithSession('StrongPassphrase123!', {
      backendEnabled: true,
      user: { id: 'user-1', email: 'user@example.com' },
      setSession,
      setGuestImportPrompt,
      setError,
      defaultGuestImportPrompt
    });

    expect(authApiMocks.deleteAccount).toHaveBeenCalledWith('StrongPassphrase123!');
    expect(indexedDbMocks.clearIngredients).toHaveBeenCalledWith({ scope: 'user:user-1' });
    expect(window.localStorage.getItem('fridgemate-guest-import:user-1')).toBeNull();
    expect(window.localStorage.getItem('fridgemate-auth-session-present:v1')).toBeNull();
    expect(setSession).toHaveBeenLastCalledWith(null);
    expect(setGuestImportPrompt).toHaveBeenCalledWith(defaultGuestImportPrompt);
    expect(setError).toHaveBeenLastCalledWith('');
    expect(result).toEqual({ localCleanupComplete: true });
  });

  it('keeps the local session when server account deletion is rejected', async () => {
    const deletionError = Object.assign(new Error('Current password is incorrect.'), { status: 403 });
    authApiMocks.deleteAccount.mockRejectedValue(deletionError);
    const { deleteAccountWithSession } = await import('../authSessionService.js');
    const setSession = vi.fn();

    await expect(
      deleteAccountWithSession('wrong-password', {
        backendEnabled: true,
        user: { id: 'user-1' },
        setSession,
        setGuestImportPrompt: vi.fn(),
        setError: vi.fn(),
        defaultGuestImportPrompt: {}
      })
    ).rejects.toBe(deletionError);

    expect(indexedDbMocks.clearIngredients).not.toHaveBeenCalled();
    expect(setSession).not.toHaveBeenCalled();
  });
});
