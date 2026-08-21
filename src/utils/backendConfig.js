function normalizeUrl(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

function parseBooleanEnv(value, defaultValue = true) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();

  if (['false', '0', 'off', 'no'].includes(normalized)) {
    return false;
  }

  if (['true', '1', 'on', 'yes'].includes(normalized)) {
    return true;
  }

  return defaultValue;
}

const rawApiBaseUrl =
  import.meta.env.VITE_API_URL_OVERRIDE ||
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  '';

export const apiBaseUrl = normalizeUrl(rawApiBaseUrl);
export const ocrEnabled = parseBooleanEnv(import.meta.env.VITE_ENABLE_OCR, true);

export function isBackendEnabled() {
  return Boolean(apiBaseUrl);
}

export function getPreferredDataSource() {
  return isBackendEnabled() ? 'api' : 'indexeddb';
}

export function isOcrEnabled() {
  return ocrEnabled;
}
