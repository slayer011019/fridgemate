import * as authApi from '../../api/authApi';
import { clearStoredAuthSession, getStoredAuthSession, saveStoredAuthSession } from './authStorage';

export function createUnavailableAuthError() {
  return new Error('Authentication is unavailable while the app is running in local-only mode.');
}

export function isAuthorizationError(error) {
  return error?.status === 401 || error?.status === 403;
}

export function persistSession(nextSession, setSession) {
  if (nextSession?.user?.id) {
    saveStoredAuthSession(nextSession);
    setSession(nextSession);
    return;
  }

  clearStoredAuthSession();
  setSession(null);
}

export async function refreshStoredSession({ backendEnabled, setSession, setLoading, setError }) {
  if (!backendEnabled) {
    persistSession(null, setSession);
    setLoading(false);
    return null;
  }

  const storedSession = getStoredAuthSession();

  setLoading(true);

  try {
    const nextSession = await authApi.refreshSession();

    persistSession(nextSession, setSession);
    setError('');
    return nextSession;
  } catch (nextError) {
    if (isAuthorizationError(nextError)) {
      persistSession(null, setSession);
      setError(nextError.message || 'Your session expired. Please log in again.');
      return null;
    }

    persistSession(storedSession, setSession);
    setError(nextError.message || 'The server could not verify the current session, so FridgeMate is keeping the local session.');
    return storedSession;
  } finally {
    setLoading(false);
  }
}

export async function signupWithSession(credentials, { backendEnabled, setSession, setError }) {
  if (!backendEnabled) {
    throw createUnavailableAuthError();
  }

  const nextSession = await authApi.signup(credentials);
  persistSession(nextSession, setSession);
  setError('');
  return nextSession;
}

export async function loginWithSession(credentials, { backendEnabled, setSession, setError }) {
  if (!backendEnabled) {
    throw createUnavailableAuthError();
  }

  const nextSession = await authApi.login(credentials);
  persistSession(nextSession, setSession);
  setError('');
  return nextSession;
}

export async function logoutSession({ backendEnabled, setSession, setGuestImportPrompt, setError, defaultGuestImportPrompt }) {
  try {
    if (backendEnabled) {
      await authApi.logout();
    }
  } catch {
    // Local logout should still succeed even if the server is unavailable.
  } finally {
    persistSession(null, setSession);
    setGuestImportPrompt(defaultGuestImportPrompt);
    setError('');
  }
}
