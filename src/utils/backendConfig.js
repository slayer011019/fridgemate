export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function isBackendEnabled() {
  return Boolean(apiBaseUrl);
}

export function getPreferredDataSource() {
  return isBackendEnabled() ? 'api' : 'indexeddb';
}
