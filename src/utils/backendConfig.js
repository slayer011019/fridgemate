export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function isBackendEnabled() {
  return Boolean(apiBaseUrl);
}
