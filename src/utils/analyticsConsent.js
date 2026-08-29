export const ANALYTICS_CONSENT_STORAGE_KEY = 'fridgemate-analytics-consent';
export const ANALYTICS_CONSENT_UPDATED_EVENT = 'fridgemate:analytics-consent-updated';
export const ANALYTICS_CONSENT_OPEN_EVENT = 'fridgemate:analytics-consent-open';

export function getAnalyticsConsent() {
  if (typeof window === 'undefined') return null;

  const value = window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
  return value === 'granted' || value === 'denied' ? value : null;
}

export function setAnalyticsConsent(value) {
  if (typeof window === 'undefined') return null;
  if (value !== 'granted' && value !== 'denied') {
    throw new Error('Analytics consent must be granted or denied.');
  }

  window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, value);
  window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_UPDATED_EVENT, { detail: { value } }));
  return value;
}

export function openAnalyticsConsentSettings() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_OPEN_EVENT));
}
