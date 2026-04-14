import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authApi from '../api/authApi';
import * as ingredientsApi from '../api/ingredientsApi';
import * as indexedDb from '../db/indexedDB';
import {
  buildUserStorageScope,
  clearStoredAuthSession,
  getGuestImportDecision,
  getStoredAuthSession,
  GUEST_STORAGE_SCOPE,
  saveStoredAuthSession,
  setGuestImportDecision
} from '../features/auth/authStorage';
import { isBackendEnabled } from '../utils/backendConfig';
import { markIngredientAsSynced } from '../utils/syncStrategy';

const defaultGuestImportPrompt = {
  available: false,
  count: 0,
  loading: false
};

const defaultAuthContext = {
  backendEnabled: isBackendEnabled(),
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

function createUnavailableAuthError() {
  return new Error('Authentication is unavailable while the app is running in local-only mode.');
}

function isAuthorizationError(error) {
  return error?.status === 401 || error?.status === 403;
}

export function AuthProvider({ children }) {
  const backendEnabled = isBackendEnabled();
  const [session, setSession] = useState(() => (backendEnabled ? getStoredAuthSession() : null));
  const [loading, setLoading] = useState(() => backendEnabled && Boolean(getStoredAuthSession()?.token));
  const [error, setError] = useState('');
  const [guestImportPrompt, setGuestImportPrompt] = useState(defaultGuestImportPrompt);

  const user = session?.user || null;
  const token = session?.token || '';
  const isAuthenticated = Boolean(user?.id && token);
  const storageScope = isAuthenticated ? buildUserStorageScope(user.id) : GUEST_STORAGE_SCOPE;

  const persistSession = useCallback((nextSession) => {
    if (nextSession?.token && nextSession?.user?.id) {
      saveStoredAuthSession(nextSession);
      setSession(nextSession);
      return;
    }

    clearStoredAuthSession();
    setSession(null);
  }, []);

  const refreshSession = useCallback(async () => {
    if (!backendEnabled) {
      persistSession(null);
      setLoading(false);
      return null;
    }

    const storedSession = getStoredAuthSession();

    if (!storedSession?.token) {
      persistSession(null);
      setLoading(false);
      return null;
    }

    setLoading(true);

    try {
      const nextUser = await authApi.getCurrentUser();
      const nextSession = {
        token: storedSession.token,
        user: nextUser
      };

      persistSession(nextSession);
      setError('');
      return nextSession;
    } catch (nextError) {
      if (isAuthorizationError(nextError)) {
        persistSession(null);
        setError(nextError.message || 'Your session expired. Please log in again.');
        return null;
      }

      persistSession(storedSession);
      setError(
        nextError.message || 'The server could not verify the current session, so FridgeMate is keeping the local session.'
      );
      return storedSession;
    } finally {
      setLoading(false);
    }
  }, [backendEnabled, persistSession]);

  useEffect(() => {
    if (!backendEnabled) {
      persistSession(null);
      setLoading(false);
      return;
    }

    refreshSession();
  }, [backendEnabled, persistSession, refreshSession]);

  useEffect(() => {
    let isMounted = true;

    if (!isAuthenticated) {
      setGuestImportPrompt(defaultGuestImportPrompt);
      return undefined;
    }

    const inspectGuestIngredients = async () => {
      const decision = getGuestImportDecision(user.id);

      if (decision) {
        if (isMounted) {
          setGuestImportPrompt(defaultGuestImportPrompt);
        }
        return;
      }

      const guestIngredients = await indexedDb.getAllIngredients({ scope: GUEST_STORAGE_SCOPE });

      if (isMounted) {
        setGuestImportPrompt({
          available: guestIngredients.length > 0,
          count: guestIngredients.length,
          loading: false
        });
      }
    };

    inspectGuestIngredients().catch(() => {
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
      if (!backendEnabled) {
        throw createUnavailableAuthError();
      }

      const nextSession = await authApi.signup(credentials);
      persistSession(nextSession);
      setError('');
      return nextSession;
    },
    [backendEnabled, persistSession]
  );

  const login = useCallback(
    async (credentials) => {
      if (!backendEnabled) {
        throw createUnavailableAuthError();
      }

      const nextSession = await authApi.login(credentials);
      persistSession(nextSession);
      setError('');
      return nextSession;
    },
    [backendEnabled, persistSession]
  );

  const logout = useCallback(async () => {
    try {
      if (backendEnabled && token) {
        await authApi.logout();
      }
    } catch {
      // Local logout should still succeed even if the server is unavailable.
    } finally {
      persistSession(null);
      setGuestImportPrompt(defaultGuestImportPrompt);
      setError('');
    }
  }, [backendEnabled, persistSession, token]);

  const importGuestIngredients = useCallback(async () => {
    if (!backendEnabled || !user?.id) {
      throw createUnavailableAuthError();
    }

    setGuestImportPrompt((current) => ({
      ...current,
      loading: true
    }));
    setError('');

    try {
      const guestIngredients = await indexedDb.getAllIngredients({ scope: GUEST_STORAGE_SCOPE });

      if (!guestIngredients.length) {
        setGuestImportDecision(user.id, 'imported');
        setGuestImportPrompt(defaultGuestImportPrompt);
        return [];
      }

      const importedIngredients = await ingredientsApi.saveIngredients(
        guestIngredients.map(({ lastSyncedAt, syncState, ...ingredient }) => ingredient)
      );

      await indexedDb.replaceIngredients(
        importedIngredients.map((ingredient) => markIngredientAsSynced(ingredient)),
        { scope: buildUserStorageScope(user.id) }
      );

      setGuestImportDecision(user.id, 'imported');
      setGuestImportPrompt(defaultGuestImportPrompt);
      return importedIngredients;
    } catch (nextError) {
      setError(nextError.message || 'Guest ingredients could not be imported.');
      throw nextError;
    } finally {
      setGuestImportPrompt((current) => ({
        ...current,
        loading: false
      }));
    }
  }, [backendEnabled, user]);

  const dismissGuestImport = useCallback(() => {
    if (!user?.id) {
      return;
    }

    setGuestImportDecision(user.id, 'dismissed');
    setGuestImportPrompt(defaultGuestImportPrompt);
  }, [user]);

  const value = useMemo(
    () => ({
      backendEnabled,
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
