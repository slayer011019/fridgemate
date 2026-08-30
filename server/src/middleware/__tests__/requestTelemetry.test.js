import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import {
  createRequestTelemetry,
  getRequestGroup,
  markRequestFailure
} from '../requestTelemetry.js';

function createResponse(statusCode = 200) {
  const response = new EventEmitter();
  response.statusCode = statusCode;
  response.setHeader = vi.fn();
  return response;
}

describe('requestTelemetry', () => {
  it('groups routes without retaining query values or record identifiers', () => {
    expect(getRequestGroup('/api/ingredients/private-record?token=secret')).toBe('/api/ingredients');
    expect(getRequestGroup('/health?verbose=true')).toBe('/health');
    expect(getRequestGroup('/api/victim@example.com?token=secret')).toBe('/api/unknown');
    expect(getRequestGroup('/victim@example.com?token=secret')).toBe('/unknown');
    expect(getRequestGroup('/api')).toBe('/api');
  });

  it('adds a request id and logs failure metadata without URLs or messages', () => {
    const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
    const now = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(275);
    const request = {
      method: 'post',
      originalUrl: '/api/ingredients/private-record?token=secret'
    };
    const response = createResponse(500);
    const next = vi.fn();
    const middleware = createRequestTelemetry({
      createRequestId: () => 'request-123',
      logger,
      now,
      slowRequestMs: 1500
    });

    middleware(request, response, next);
    markRequestFailure(request, {
      name: 'DatabaseError',
      code: 'DB_DOWN',
      message: 'postgresql://private-user:private-pass@example.com'
    });
    response.emit('finish');

    expect(next).toHaveBeenCalledOnce();
    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', 'request-123');
    expect(logger.error).toHaveBeenCalledWith(
      '[server] api telemetry',
      expect.objectContaining({
        event: 'api_request_failed',
        requestId: 'request-123',
        method: 'POST',
        requestGroup: '/api/ingredients',
        status: 500,
        durationMs: 175,
        errorName: 'DatabaseError',
        errorCode: 'DB_DOWN'
      })
    );
    const logged = JSON.stringify(logger.error.mock.calls);
    expect(logged).not.toContain('private-record');
    expect(logged).not.toContain('secret');
    expect(logged).not.toContain('private-pass');
  });

  it('records a nested error code without logging nested messages', () => {
    const request = { telemetry: { failure: null } };
    const privateCause = Object.assign(new Error('private database detail'), {
      code: 'INGREDIENT_QUOTA_LOCK'
    });

    markRequestFailure(request, new Error('outer error', { cause: privateCause }));

    expect(request.telemetry.failure).toEqual({
      errorName: 'Error',
      errorCode: 'INGREDIENT_QUOTA_LOCK'
    });
    expect(JSON.stringify(request.telemetry.failure)).not.toContain('private database detail');
  });

  it('does not let an unknown request path inject personal data into telemetry', () => {
    const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
    const now = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(125);
    const response = createResponse(404);
    const middleware = createRequestTelemetry({
      createRequestId: () => 'request-unknown',
      logger,
      now,
      slowRequestMs: 1500
    });

    middleware(
      { method: 'GET', originalUrl: '/api/victim@example.com?token=secret' },
      response,
      vi.fn()
    );
    response.emit('finish');

    expect(logger.warn).toHaveBeenCalledWith(
      '[server] api telemetry',
      expect.objectContaining({ requestGroup: '/api/unknown', status: 404 })
    );
    const logged = JSON.stringify(logger.warn.mock.calls);
    expect(logged).not.toContain('victim@example.com');
    expect(logged).not.toContain('secret');
  });

  it('logs slow successful requests without recording ordinary successful traffic', () => {
    const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
    const now = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(1600);
    const response = createResponse(200);
    const middleware = createRequestTelemetry({
      createRequestId: () => 'request-slow',
      logger,
      now,
      slowRequestMs: 1500
    });

    middleware({ method: 'GET', originalUrl: '/api/recipes/recommendations' }, response, vi.fn());
    response.emit('finish');

    expect(logger.info).toHaveBeenCalledWith(
      '[server] api telemetry',
      expect.objectContaining({ event: 'api_request_slow', requestGroup: '/api/recipes' })
    );
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });
});
