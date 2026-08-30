import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  buildUserStorageScope,
  GUEST_STORAGE_SCOPE
} from '../features/auth/authStorage';
import {
  deleteAccountWithSession,
  loginWithSession,
  logoutSession,
  refreshStoredSession,
  signupWithSession
} from '../features/auth/authSessionService';
import {
  dismissGuestImportPrompt,
  importGuestIngredientsForUser,
  inspectGuestImportPrompt
} from '../features/auth/guestImportService';
import { isBackendEnabled } from '../utils/backendConfig';

const defaultGuestImportPrompt = {
  available: false,
  count: 0,
  loading: false
};

const defaultAuthContext = {
  backendEnabled: isBackendEnabled(),
  deleteAccount: async () => ({ localCleanupComplete: false }),
  dismissGuestImport: () => {},
  error: '',
  guestImportPrompt: defaultGuestImportPrompt,
  importGuestIngredients: async () => [],
  isAuthenticated: false,
  loading: false,
  login: async () => null,
  logout: async () => {},
  refreshSession: async () => null,
  signup: async () => null,
  storageScope: GUEST_STORAGE_SCOPE,
  token: '',
  user: null
};

const AuthContext = createContext(defaultAuthContext);
const inFlightSessionRefreshes = new WeakMap();

export function AuthProvider({ children }) {
  const backendEnabled = isBackendEnabled();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(() => backendEnabled);
  const [error, setError] = useState('');
  const [guestImportPrompt, setGuestImportPrompt] = useState(defaultGuestImportPrompt);

  const user = session?.user || null;
  const token = '';
  const isAuthenticated = Boolean(user?.id);
  const storageScope = user?.id ? buildUserStorageScope(user.id) : GUEST_STORAGE_SCOPE;

  const refreshSession = useCallback(() => {
    const existingRefresh = inFlightSessionRefreshes.get(setSession);

    if (existingRefresh) {
      return existingRefresh;
    }

    const refreshPromise = refreshStoredSession({
      backendEnabled,
      setSession,
      setLoading,
      setError
    }).finally(() => {
      if (inFlightSessionRefreshes.get(setSession) === refreshPromise) {
        inFlightSessionRefreshes.delete(setSession);
      }
    });

    inFlightSessionRefreshes.set(setSession, refreshPromise);
    return refreshPromise;
  }, [backendEnabled]);

  useEffect(() => {
    refreshSession();
  }, [backendEnabled, refreshSession]);

  useEffect(() => {
    let isMounted = true;

    inspectGuestImportPrompt({
      isAuthenticated,
      user,
      setGuestImportPrompt: (nextValue) => {
        if (isMounted) {
          setGuestImportPrompt(nextValue);
        }
      },
      defaultGuestImportPrompt
    }).catch(() => {
      if (isMounted) {
        setGuestImportPrompt(defaultGuestImportPrompt);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, user]);

  const signup = useCallback(
    async (credentials) => {
      return signupWithSession(credentials, {
        backendEnabled,
        setSession,
        setError
      });
    },
    [backendEnabled]
  );

  const login = useCallback(
    async (credentials) => {
      return loginWithSession(credentials, {
        backendEnabled,
        setSession,
        setError
      });
    },
    [backendEnabled]
  );

  const logout = useCallback(
    async () =>
      logoutSession({
        backendEnabled,
        setSession,
        setGuestImportPrompt,
        setError,
        defaultGuestImportPrompt
      }),
    [backendEnabled]
  );

  const deleteAccount = useCallback(
    async (password) =>
      deleteAccountWithSession(password, {
        backendEnabled,
        user,
        setSession,
        setGuestImportPrompt,
        setError,
        defaultGuestImportPrompt
      }),
    [backendEnabled, user]
  );

  const importGuestIngredients = useCallback(
    async () =>
      importGuestIngredientsForUser({
        backendEnabled,
        user,
        setGuestImportPrompt,
        setError,
        defaultGuestImportPrompt
      }),
    [backendEnabled, user]
  );

  const dismissGuestImport = useCallback(
    () =>
      dismissGuestImportPrompt({
        user,
        setGuestImportPrompt,
        defaultGuestImportPrompt
      }),
    [user]
  );

  const value = useMemo(
    () => ({
      backendEnabled,
      deleteAccount,
      dismissGuestImport,
      error,
      guestImportPrompt,
      importGuestIngredients,
      isAuthenticated,
      loading,
      login,
      logout,
      refreshSession,
      signup,
      storageScope,
      token,
      user
    }),
    [
      backendEnabled,
      deleteAccount,
      dismissGuestImport,
      error,
      guestImportPrompt,
      importGuestIngredients,
      isAuthenticated,
      loading,
      login,
      logout,
      refreshSession,
      signup,
      storageScope,
      token,
      user
    ]
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  return useContext(AuthContext);
}
