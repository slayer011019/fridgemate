import { serverConfig } from '../config.js';

const KNOWN_API_GROUPS = new Set([
  'auth',
  'health',
  'import',
  'ingredients',
  'menu-decisions',
  'pantry-ownership',
  'product-events',
  'recipes',
  'recommendation-events',
  'user-preferences'
]);
const KNOWN_ROOT_GROUPS = new Set(['health']);

function createRequestId() {
  return globalThis.crypto.randomUUID();
}

export function getRequestGroup(originalUrl = '/') {
  let pathname = '/';

  try {
    pathname = new URL(String(originalUrl || '/'), 'http://localhost').pathname;
  } catch (_error) {
    pathname = '/';
  }

  const segments = pathname.split('/').filter(Boolean);

  if (!segments.length) return '/';
  if (segments[0] === 'api') {
    if (!segments[1]) return '/api';
    return KNOWN_API_GROUPS.has(segments[1]) ? `/api/${segments[1]}` : '/api/unknown';
  }

  return KNOWN_ROOT_GROUPS.has(segments[0]) ? `/${segments[0]}` : '/unknown';
}

function getNestedErrorCode(error) {
  const queue = [error];
  const seen = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (!current || (typeof current !== 'object' && typeof current !== 'function') || seen.has(current)) {
      continue;
    }
    seen.add(current);

    if (current.code != null) return String(current.code).slice(0, 80);
    queue.push(
      current.cause,
      current.originalError,
      current.meta?.driverAdapterError?.cause
    );
  }

  return null;
}

export function markRequestFailure(request, error) {
  if (!request.telemetry) return;

  request.telemetry.failure = {
    errorName: String(error?.name || 'Error').slice(0, 80),
    errorCode: getNestedErrorCode(error)
  };
}

export function createRequestTelemetry(options = {}) {
  const logger = options.logger || console;
  const now = options.now || Date.now;
  const nextRequestId = options.createRequestId || createRequestId;
  const configuredSlowRequestMs = Number(options.slowRequestMs ?? serverConfig.apiSlowRequestMs);
  const slowRequestMs = Number.isFinite(configuredSlowRequestMs)
    ? Math.max(0, configuredSlowRequestMs)
    : 1500;

  return function requestTelemetry(request, response, next) {
    const startedAt = now();
    const requestId = nextRequestId();
    request.telemetry = { requestId, startedAt, failure: null };
    response.setHeader('x-request-id', requestId);

    response.once('finish', () => {
      const status = Number(response.statusCode || 200);
      const durationMs = Math.max(0, Math.round(now() - startedAt));
      const isFailure = status >= 400;
      const isSlow = slowRequestMs > 0 && durationMs >= slowRequestMs;

      if (!isFailure && !isSlow) return;

      const event = {
        event: isFailure ? 'api_request_failed' : 'api_request_slow',
        requestId,
        method: String(request.method || 'UNKNOWN').toUpperCase(),
        requestGroup: getRequestGroup(request.originalUrl),
        status,
        durationMs,
        errorName: request.telemetry.failure?.errorName || null,
        errorCode: request.telemetry.failure?.errorCode || null
      };

      const logMethod = status >= 500 ? 'error' : isFailure ? 'warn' : 'info';
      logger[logMethod]?.('[server] api telemetry', event);
    });

    next();
  };
}
