export const DEFAULT_EXTERNAL_AI_TIMEOUT_MS = 15_000;

const MAX_EXTERNAL_AI_TIMEOUT_MS = 120_000;
const SAFE_EXTERNAL_AI_ERROR = Symbol('safeExternalAiError');

function normalizeProviderLabel(value) {
  const normalized = String(value || 'External AI provider')
    .replace(/[^a-z0-9 ._-]/giu, '')
    .trim()
    .slice(0, 80);

  return normalized || 'External AI provider';
}

function normalizeTimeoutMs(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_EXTERNAL_AI_TIMEOUT_MS;
  }

  return Math.min(Math.floor(parsed), MAX_EXTERNAL_AI_TIMEOUT_MS);
}

function createSafeError(message, { code, status = 0 } = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error[SAFE_EXTERNAL_AI_ERROR] = true;
  return error;
}

function createTimeoutSignal(timeoutMs) {
  if (typeof globalThis.AbortSignal?.timeout === 'function') {
    return {
      signal: AbortSignal.timeout(timeoutMs),
      cancel: () => {}
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    const timeoutError = new Error('External AI request timed out.');
    timeoutError.name = 'TimeoutError';
    controller.abort(timeoutError);
  }, timeoutMs);

  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timeoutId)
  };
}

function isTimeoutError(error, signal) {
  return Boolean(
    signal.aborted ||
      error?.name === 'TimeoutError' ||
      (error?.name === 'AbortError' && signal.reason?.name === 'TimeoutError')
  );
}

/**
 * Runs a complete provider operation under one deadline. The operation must not
 * return until the response body has been consumed so a slow body cannot escape
 * the timeout boundary.
 */
export async function withExternalAiTimeout({ provider, timeoutMs, operation }) {
  const providerLabel = normalizeProviderLabel(provider);
  const normalizedTimeoutMs = normalizeTimeoutMs(timeoutMs);
  const { signal, cancel } = createTimeoutSignal(normalizedTimeoutMs);

  try {
    return await operation(signal);
  } catch (error) {
    if (error?.[SAFE_EXTERNAL_AI_ERROR]) {
      throw error;
    }

    if (isTimeoutError(error, signal)) {
      throw createSafeError(`${providerLabel} request timed out.`, {
        code: 'EXTERNAL_AI_TIMEOUT'
      });
    }

    throw createSafeError(`${providerLabel} request failed because of a network error.`, {
      code: 'EXTERNAL_AI_NETWORK_ERROR'
    });
  } finally {
    cancel();
  }
}

/**
 * Fetches and parses a JSON response without ever reading or including an error
 * response body in the thrown error.
 */
export async function requestExternalAiJson({
  provider,
  url,
  fetchImpl = globalThis.fetch,
  init = {},
  timeoutMs = DEFAULT_EXTERNAL_AI_TIMEOUT_MS
}) {
  const providerLabel = normalizeProviderLabel(provider);

  if (typeof fetchImpl !== 'function') {
    throw createSafeError(`${providerLabel} request is unavailable.`, {
      code: 'EXTERNAL_AI_UNAVAILABLE'
    });
  }

  return withExternalAiTimeout({
    provider: providerLabel,
    timeoutMs,
    operation: async (signal) => {
      const response = await fetchImpl(url, {
        ...init,
        signal
      });
      const status = Number.isInteger(response?.status) && response.status >= 100 && response.status <= 599
        ? response.status
        : 0;

      if (!response?.ok) {
        throw createSafeError(
          status
            ? `${providerLabel} request failed with status ${status}.`
            : `${providerLabel} request failed.`,
          {
            code: 'EXTERNAL_AI_HTTP_ERROR',
            status
          }
        );
      }

      let payload;

      try {
        payload = await response.json();
      } catch (error) {
        if (isTimeoutError(error, signal)) {
          throw error;
        }

        throw createSafeError(`${providerLabel} returned an invalid JSON response.`, {
          code: 'EXTERNAL_AI_INVALID_RESPONSE',
          status
        });
      }

      return { payload, status };
    }
  });
}
