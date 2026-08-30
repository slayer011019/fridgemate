import { apiBaseUrl } from '../utils/backendConfig';

export class ApiClientError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiClientError';
    this.status = options.status;
    this.path = options.path;
    this.requestId = options.requestId || null;
    this.cause = options.cause;
  }
}

function buildHeaders(headers = {}) {
  return { ...headers };
}

let inFlightAuthRefresh = null;

async function performAuthSessionRefresh() {
  try {
    const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include'
    });
    return response.ok;
  } catch {
    return false;
  }
}

function tryRefreshAuthSession() {
  if (!inFlightAuthRefresh) {
    inFlightAuthRefresh = performAuthSessionRefresh().finally(() => {
      inFlightAuthRefresh = null;
    });
  }

  return inFlightAuthRefresh;
}

export async function requestJson(
  path,
  options = {},
  { authMode = 'auto', errorClass = ApiClientError, allowNoContent = false } = {}
) {
  let response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers: buildHeaders(options.headers)
    });
  } catch (error) {
    throw new errorClass('API request could not reach the server.', {
      path,
      cause: error
    });
  }

  if (!response.ok && response.status === 401 && authMode === 'required' && !options.__skipRefreshRetry) {
    const refreshed = await tryRefreshAuthSession();

    if (refreshed) {
      return requestJson(
        path,
        {
          ...options,
          __skipRefreshRetry: true
        },
        { authMode, errorClass, allowNoContent }
      );
    }
  }

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new errorClass(errorPayload.message || 'API request failed.', {
      status: response.status,
      path,
      requestId: errorPayload.requestId || response.headers?.get?.('x-request-id') || null
    });
  }

  if (response.status === 204) {
    return allowNoContent ? null : {};
  }

  return response.json();
}
