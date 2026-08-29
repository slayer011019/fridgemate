import { serverConfig } from '../config.js';

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
  const groupLength = segments[0] === 'api' ? 2 : 1;
  return segments.length ? `/${segments.slice(0, groupLength).join('/')}` : '/';
}

export function markRequestFailure(request, error) {
  if (!request.telemetry) return;

  request.telemetry.failure = {
    errorName: String(error?.name || 'Error').slice(0, 80),
    errorCode: error?.code == null ? null : String(error.code).slice(0, 80)
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
