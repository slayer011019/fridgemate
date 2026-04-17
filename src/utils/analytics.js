import { getRemainingDays } from './date';
import { isBackendEnabled } from './backendConfig';

const ANALYTICS_ID_KEY = 'fridgemate-analytics-id';
const ANALYTICS_SESSION_ID_KEY = 'fridgemate-analytics-session-id';
const ANALYTICS_SESSION_STARTED_KEY = 'fridgemate-analytics-session-started';
const ANALYTICS_EVENT_STORE_KEY = '__FRIDGEMATE_ANALYTICS_EVENTS__';
const ANALYTICS_EVENT_NAME = 'fridgemate:analytics';

function getStorage(type) {
  if (typeof window === 'undefined') {
    return null;
  }

  return window[type];
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `fm-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getOrCreateStoredValue(key, storageType) {
  const storage = getStorage(storageType);

  if (!storage) {
    return createId();
  }

  const existingValue = storage.getItem(key);

  if (existingValue) {
    return existingValue;
  }

  const nextValue = createId();
  storage.setItem(key, nextValue);
  return nextValue;
}

export function getAnonymousAnalyticsId() {
  return getOrCreateStoredValue(ANALYTICS_ID_KEY, 'localStorage');
}

export function getAnalyticsSessionId() {
  return getOrCreateStoredValue(ANALYTICS_SESSION_ID_KEY, 'sessionStorage');
}

export function hasTrackedSessionStarted() {
  const storage = getStorage('sessionStorage');
  return storage?.getItem(ANALYTICS_SESSION_STARTED_KEY) === 'true';
}

export function markSessionStartedTracked() {
  const storage = getStorage('sessionStorage');

  if (!storage) {
    return;
  }

  storage.setItem(ANALYTICS_SESSION_STARTED_KEY, 'true');
}

export function getDeviceType() {
  if (typeof window === 'undefined') {
    return 'desktop';
  }

  return window.innerWidth < 768 ? 'mobile' : 'desktop';
}

export function getNetworkState() {
  if (typeof navigator === 'undefined') {
    return 'online';
  }

  return navigator.onLine === false ? 'offline' : 'online';
}

export function getApiMode() {
  return isBackendEnabled() ? 'backend_enabled' : 'local_only';
}

export function getDaysToExpiryBucket(expiryDate) {
  const remainingDays = getRemainingDays(expiryDate);

  if (remainingDays === null) {
    return 'unknown';
  }

  if (remainingDays < 0) {
    return 'expired';
  }

  if (remainingDays === 0) {
    return 'today';
  }

  if (remainingDays <= 3) {
    return '1_to_3';
  }

  if (remainingDays <= 7) {
    return '4_to_7';
  }

  return '8_plus';
}

export function buildAnalyticsPayload({ eventName, route, isAuthenticated, userId, properties = {} }) {
  return {
    event_name: eventName,
    occurred_at: new Date().toISOString(),
    session_id: getAnalyticsSessionId(),
    analytics_id: getAnonymousAnalyticsId(),
    user_mode: isAuthenticated ? 'authenticated' : 'guest',
    user_id: userId || null,
    route: route || '/',
    device_type: getDeviceType(),
    api_mode: getApiMode(),
    network_state: getNetworkState(),
    app_version: import.meta.env.VITE_APP_VERSION || null,
    ...properties
  };
}

export function recordAnalyticsEvent(payload) {
  if (typeof window === 'undefined') {
    return payload;
  }

  const events = window[ANALYTICS_EVENT_STORE_KEY] || [];
  events.push(payload);
  window[ANALYTICS_EVENT_STORE_KEY] = events;
  window.dispatchEvent(new CustomEvent(ANALYTICS_EVENT_NAME, { detail: payload }));

  if (import.meta.env.DEV) {
    console.info('[analytics]', payload.event_name, payload);
  }

  return payload;
}
