import * as authApi from '../../api/authApi';
import * as indexedDb from '../../db/indexedDB';
import {
  buildUserStorageScope,
  clearGuestImportDecision,
  clearPendingLogout,
  clearSessionHint,
  clearStoredAuthSession,
  hasPendingLogout,
  hasSessionHint,
  markLogoutPending,
  markSessionPresent
} from './authStorage';

export const SESSION_VERIFICATION_FAILED_MESSAGE =
  '서버에서 세션을 확인하지 못해 안전을 위해 로그아웃했습니다. 연결을 확인한 뒤 다시 로그인해주세요.';
export const LOGOUT_PENDING_MESSAGE =
  '이 기기에서는 로그아웃했지만 서버 처리 결과를 확인하지 못했습니다. 연결이 복구되면 로그아웃 상태를 다시 확인합니다.';
export const LOGOUT_FAILED_MESSAGE =
  '이 기기 화면에서는 로그아웃했지만 서버 처리와 재시도 상태를 확인하지 못했습니다. 브라우저를 닫고 연결 복구 후 다시 로그인해주세요.';

export function createUnavailableAuthError() {
  return new Error('Authentication is unavailable while the app is running in local-only mode.');
}

export function isAuthorizationError(error) {
  return error?.status === 401 || error?.status === 403;
}

export function persistSession(nextSession, setSession) {
  clearStoredAuthSession();

  if (nextSession?.user?.id) {
    markSessionPresent();
    setSession(nextSession);
    return;
  }

  clearSessionHint();
  setSession(null);
}

export async function refreshStoredSession({ backendEnabled, setSession, setLoading, setError }) {
  if (!backendEnabled) {
    persistSession(null, setSession);
    setLoading(false);
    return null;
  }

  setLoading(true);

  try {
    if (hasPendingLogout()) {
      persistSession(null, setSession);

      try {
        await authApi.logout();
        clearPendingLogout();
        setError('');
      } catch {
        setError(LOGOUT_PENDING_MESSAGE);
      }

      return null;
    }

    if (!hasSessionHint()) {
      persistSession(null, setSession);
      setError('');
      return null;
    }

    const nextSession = await authApi.refreshSession();

    persistSession(nextSession, setSession);
    setError('');
    return nextSession;
  } catch (nextError) {
    persistSession(null, setSession);

    if (isAuthorizationError(nextError)) {
      setError(nextError.message || 'Your session expired. Please log in again.');
      return null;
    }

    setError(SESSION_VERIFICATION_FAILED_MESSAGE);
    return null;
  } finally {
    setLoading(false);
  }
}

export async function signupWithSession(credentials, { backendEnabled, setSession, setError }) {
  if (!backendEnabled) {
    throw createUnavailableAuthError();
  }

  const nextSession = await authApi.signup(credentials);
  clearPendingLogout();
  persistSession(nextSession, setSession);
  setError('');
  return nextSession;
}

export async function loginWithSession(credentials, { backendEnabled, setSession, setError }) {
  if (!backendEnabled) {
    throw createUnavailableAuthError();
  }

  const nextSession = await authApi.login(credentials);
  clearPendingLogout();
  persistSession(nextSession, setSession);
  setError('');
  return nextSession;
}

export async function logoutSession({
  backendEnabled,
  setSession,
  setGuestImportPrompt,
  setError,
  defaultGuestImportPrompt
}) {
  if (!backendEnabled) {
    clearPendingLogout();
    persistSession(null, setSession);
    setGuestImportPrompt(defaultGuestImportPrompt);
    setError('');
    return { ok: true, pending: false };
  }

  const logoutFenced = markLogoutPending();
  persistSession(null, setSession);

  try {
    await authApi.logout();
    clearPendingLogout();
    persistSession(null, setSession);
    setGuestImportPrompt(defaultGuestImportPrompt);
    setError('');
    return { ok: true, pending: false };
  } catch {
    setGuestImportPrompt(defaultGuestImportPrompt);

    if (logoutFenced) {
      setError(LOGOUT_PENDING_MESSAGE);
      return { ok: false, pending: true };
    }

    setError(LOGOUT_FAILED_MESSAGE);
    return { ok: false, pending: false };
  }
}

export async function deleteAccountWithSession(
  password,
  {
    backendEnabled,
    user,
    setSession,
    setGuestImportPrompt,
    setError,
    defaultGuestImportPrompt
  }
) {
  if (!backendEnabled || !user?.id) {
    throw createUnavailableAuthError();
  }

  await authApi.deleteAccount(password);

  let localCleanupComplete = true;

  try {
    await indexedDb.clearIngredients({ scope: buildUserStorageScope(user.id) });
    clearGuestImportDecision(user.id);
  } catch {
    localCleanupComplete = false;
  }

  clearPendingLogout();
  persistSession(null, setSession);
  setGuestImportPrompt(defaultGuestImportPrompt);
  setError(
    localCleanupComplete
      ? ''
      : '계정은 삭제됐지만 이 기기의 로컬 캐시를 모두 지우지 못했습니다. 브라우저 사이트 데이터를 삭제해주세요.'
  );

  return { localCleanupComplete };
}
