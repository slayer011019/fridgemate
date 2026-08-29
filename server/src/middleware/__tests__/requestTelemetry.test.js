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
