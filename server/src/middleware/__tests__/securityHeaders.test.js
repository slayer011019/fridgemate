import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureServerRuntime } from '../../config.js';
import { securityHeaders } from '../securityHeaders.js';

function createResponse() {
  const headers = new Map();

  return {
    headers,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    }
  };
}

afterEach(() => {
  configureServerRuntime(process.env);
});

describe('securityHeaders', () => {
  it('prevents API responses from being cached or rendered as active content', () => {
    configureServerRuntime({ NODE_ENV: 'development' });
    const response = createResponse();
    const next = vi.fn();

    securityHeaders({}, response, next);

    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.has('strict-transport-security')).toBe(false);
    expect(next).toHaveBeenCalledOnce();
  });

  it('adds HSTS in production', () => {
    configureServerRuntime({ NODE_ENV: 'production' });
    const response = createResponse();

    securityHeaders({}, response, vi.fn());

    expect(response.headers.get('strict-transport-security')).toBe('max-age=31536000');
  });
});
