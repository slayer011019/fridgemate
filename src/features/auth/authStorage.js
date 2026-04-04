const AUTH_SESSION_KEY = 'fridgemate-auth-session';
const GUEST_IMPORT_DECISION_PREFIX = 'fridgemate-guest-import';
export const GUEST_STORAGE_SCOPE = 'guest';

function getStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

function readJson(key, fallbackValue) {
  const storage = getStorage();

  if (!storage) {
    return fallbackValue;
  }

  try {
    const value = storage.getItem(key);
    return value ? JSON.parse(value) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function writeJson(key, value) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(key, JSON.stringify(value));
}

export function buildUserStorageScope(userId) {
  return userId ? `user:${userId}` : GUEST_STORAGE_SCOPE;
}

export function getStoredAuthSession() {
  const session = readJson(AUTH_SESSION_KEY, null);

  if (!session?.token || !session?.user?.id) {
    return null;
  }

  return session;
}

export function saveStoredAuthSession(session) {
  writeJson(AUTH_SESSION_KEY, session);
}

export function clearStoredAuthSession() {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.removeItem(AUTH_SESSION_KEY);
}

export function getAuthToken() {
  return getStoredAuthSession()?.token || '';
}

function getGuestImportDecisionKey(userId) {
  return `${GUEST_IMPORT_DECISION_PREFIX}:${userId}`;
}

export function getGuestImportDecision(userId) {
  if (!userId) {
    return '';
  }

  const storage = getStorage();

  if (!storage) {
    return '';
  }

  return storage.getItem(getGuestImportDecisionKey(userId)) || '';
}

export function setGuestImportDecision(userId, decision) {
  if (!userId) {
    return;
  }

  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(getGuestImportDecisionKey(userId), decision);
}
