import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authApiMocks = {
  signup: vi.fn(),
  login: vi.fn(),
  getCurrentUser: vi.fn(),
  logout: vi.fn()
};

const ingredientsApiMocks = {
  saveIngredients: vi.fn()
};

const dbMocks = {
  getAllIngredients: vi.fn(),
  replaceIngredients: vi.fn()
};

vi.mock('../../api/authApi.js', () => ({
  signup: (...args) => authApiMocks.signup(...args),
  login: (...args) => authApiMocks.login(...args),
  getCurrentUser: (...args) => authApiMocks.getCurrentUser(...args),
  logout: (...args) => authApiMocks.logout(...args)
}));

vi.mock('../../api/ingredientsApi.js', () => ({
  saveIngredients: (...args) => ingredientsApiMocks.saveIngredients(...args)
}));

vi.mock('../../db/indexedDB.js', () => ({
  getAllIngredients: (...args) => dbMocks.getAllIngredients(...args),
  replaceIngredients: (...args) => dbMocks.replaceIngredients(...args)
}));

vi.mock('../../utils/backendConfig.js', () => ({
  apiBaseUrl: 'https://api.example.com',
  isBackendEnabled: () => true,
  getPreferredDataSource: () => 'api'
}));

async function renderUseAuth() {
  vi.resetModules();
  const { AuthProvider, useAuth } = await import('../useAuth.js');
  const wrapper = ({ children }) => createElement(AuthProvider, null, children);
  return renderHook(() => useAuth(), { wrapper });
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    authApiMocks.signup.mockResolvedValue({
      token: 'signup-token',
      user: { id: 'user-1', email: 'signup@example.com' }
    });
    authApiMocks.login.mockResolvedValue({
      token: 'login-token',
      user: { id: 'user-1', email: 'login@example.com' }
    });
    authApiMocks.getCurrentUser.mockResolvedValue({
      id: 'user-1',
      email: 'restored@example.com'
    });
    authApiMocks.logout.mockResolvedValue(null);
    ingredientsApiMocks.saveIngredients.mockResolvedValue([]);
    dbMocks.getAllIngredients.mockResolvedValue([]);
    dbMocks.replaceIngredients.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('hydrates a stored session and restores the current user', async () => {
    window.localStorage.setItem(
      'fridgemate-auth-session',
      JSON.stringify({
        token: 'stored-token',
        user: { id: 'user-1', email: 'stale@example.com' }
      })
    );

    const { result } = await renderUseAuth();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(authApiMocks.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user.email).toBe('restored@example.com');
    expect(result.current.storageScope).toBe('user:user-1');
  });

  it('clears the session on logout', async () => {
    const { result } = await renderUseAuth();

    await act(async () => {
      await result.current.login({
        email: 'login@example.com',
        password: 'password123'
      });
    });

    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(window.localStorage.getItem('fridgemate-auth-session')).toBeNull();
  });

  it('exposes a guest import prompt when guest ingredients exist', async () => {
    authApiMocks.getCurrentUser.mockResolvedValue({
      id: 'user-1',
      email: 'restored@example.com'
    });
    dbMocks.getAllIngredients.mockResolvedValue([{ id: 'guest-1', name: 'guest-ingredient' }]);

    window.localStorage.setItem(
      'fridgemate-auth-session',
      JSON.stringify({
        token: 'stored-token',
        user: { id: 'user-1', email: 'stale@example.com' }
      })
    );

    const { result } = await renderUseAuth();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await waitFor(() => {
      expect(result.current.guestImportPrompt.available).toBe(true);
    });

    expect(result.current.guestImportPrompt.count).toBe(1);
  });
});
