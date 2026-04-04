import { getAuthToken } from '../features/auth/authStorage';
import { apiBaseUrl } from '../utils/backendConfig';

export class ApiClientError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiClientError';
    this.status = options.status;
    this.path = options.path;
    this.cause = options.cause;
  }
}

function buildHeaders(headers = {}, authMode = 'auto') {
  const nextHeaders = { ...headers };
  const token = getAuthToken();

  if (authMode !== 'never' && token) {
    nextHeaders.Authorization = `Bearer ${token}`;
  }

  return nextHeaders;
}

export async function requestJson(
  path,
  options = {},
  { authMode = 'auto', errorClass = ApiClientError, allowNoContent = false } = {}
) {
  const token = getAuthToken();

  if (authMode === 'required' && !token) {
    throw new errorClass('Authentication is required.', {
      status: 401,
      path
    });
  }

  let response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: buildHeaders(options.headers, authMode)
    });
  } catch (error) {
    throw new errorClass('API request could not reach the server.', {
      path,
      cause: error
    });
  }

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new errorClass(errorPayload.message || 'API request failed.', {
      status: response.status,
      path
    });
  }

  if (response.status === 204) {
    return allowNoContent ? null : {};
  }

  return response.json();
}
