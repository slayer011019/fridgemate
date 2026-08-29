import { getAnalyticsConsent } from './analyticsConsent';

const GA_SCRIPT_SELECTOR = 'script[data-fridgemate-ga]';
const BLOCKED_PARAMETER_KEYS = new Set([
  'analytics_id',
  'session_id',
  'user_id',
  'email',
  'occurred_at'
]);

function getMeasurementId() {
  const measurementId = String(import.meta.env.VITE_GA_MEASUREMENT_ID || '').trim();
  return /^G-[A-Z0-9]+$/u.test(measurementId) ? measurementId : '';
}

function isSafePrimitive(value) {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function looksLikeEmail(value) {
  return typeof value === 'string' && /\S+@\S+\.\S+/u.test(value);
}

export function sanitizeGoogleAnalyticsParameters(payload = {}) {
  return Object.entries(payload).reduce((parameters, [key, value]) => {
    if (BLOCKED_PARAMETER_KEYS.has(key) || /(?:^|_)email$/iu.test(key)) return parameters;
    if (!isSafePrimitive(value) || looksLikeEmail(value)) return parameters;

    parameters[key] = typeof value === 'string' ? value.slice(0, 100) : value;
    return parameters;
  }, {});
}

function installGtag() {
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer.push(arguments);
    };
}

export function initializeGoogleAnalytics() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (getAnalyticsConsent() !== 'granted') return false;

  const measurementId = getMeasurementId();
  if (!measurementId) return false;

  installGtag();

  if (!document.head.querySelector(GA_SCRIPT_SELECTOR)) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.dataset.fridgemateGa = measurementId;
    document.head.appendChild(script);

    window.gtag('js', new Date());
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    window.gtag('config', measurementId, {
      send_page_view: false,
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });
  }

  return true;
}

export function disableGoogleAnalytics() {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('consent', 'update', { analytics_storage: 'denied' });
}

export function trackGoogleAnalyticsEvent(payload) {
  if (!payload?.event_name || !initializeGoogleAnalytics()) return false;

  const parameters = sanitizeGoogleAnalyticsParameters({
    ...payload,
    page_path: payload.route || '/'
  });
  delete parameters.event_name;
  delete parameters.route;

  window.gtag('event', payload.event_name, parameters);
  return true;
}
