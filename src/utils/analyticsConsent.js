export const ANALYTICS_CONSENT_STORAGE_KEY = 'fridgemate-analytics-consent';
export const ANALYTICS_CONSENT_UPDATED_EVENT = 'fridgemate:analytics-consent-updated';
export const ANALYTICS_CONSENT_OPEN_EVENT = 'fridgemate:analytics-consent-open';
export const ANALYTICS_ID_STORAGE_KEY = 'fridgemate-analytics-id';
export const ANALYTICS_SESSION_ID_STORAGE_KEY = 'fridgemate-analytics-session-id';
export const ANALYTICS_SESSION_STARTED_STORAGE_KEY = 'fridgemate-analytics-session-started';
export const ANALYTICS_EVENT_STORE_KEY = '__FRIDGEMATE_ANALYTICS_EVENTS__';

// A failed choice must not revive an older persisted approval in this document.
// Only a later explicit, successfully saved choice clears this temporary block.
let blockedForDocument = false;

export function getAnalyticsConsent() {
  if (typeof window === 'undefined' || blockedForDocument) return null;

  try {
    const value = window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

export function setAnalyticsConsent(value) {
  if (typeof window === 'undefined') return null;
  if (value !== 'granted' && value !== 'denied') {
    throw new Error('Analytics consent must be granted or denied.');
  }

  blockedForDocument = true;
  let saved = false;
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, value);
    saved = window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY) === value;
  } catch {
    // Keep analytics disabled without exposing browser/storage error details.
  }

  if (value === 'denied') {
    for (const [storageType, key] of [
      ['localStorage', ANALYTICS_ID_STORAGE_KEY],
      ['sessionStorage', ANALYTICS_SESSION_ID_STORAGE_KEY],
      ['sessionStorage', ANALYTICS_SESSION_STARTED_STORAGE_KEY]
    ]) {
      try {
        window[storageType].removeItem(key);
      } catch {
        saved = false;
      }
    }
  }
  if (value === 'denied' || !saved) {
    window[ANALYTICS_EVENT_STORE_KEY] = [];
  }

  blockedForDocument = !saved;
  const choice = saved ? value : null;
  window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_UPDATED_EVENT, { detail: { value: choice } }));
  return choice;
}

export function openAnalyticsConsentSettings() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_OPEN_EVENT));
}
