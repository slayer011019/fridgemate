import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('server config security requirements', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'production',
      JWT_SECRET: '12345678901234567890123456789012',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/fridgemate'
    };
    delete process.env.REDIS_URL;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('requires Redis for a production Node server', async () => {
    const { validateServerConfig } = await import('../config.js');

    expect(validateServerConfig({ exitOnError: false })).toContain(
      'REDIS_URL is required for a production Node server.'
    );
  });

  it('does not require Redis when Cloudflare Hyperdrive is configured', async () => {
    const { configureServerRuntime, validateServerConfig } = await import('../config.js');

    configureServerRuntime({
      NODE_ENV: 'production',
      JWT_SECRET: '12345678901234567890123456789012',
      HYPERDRIVE: {
        connectionString: 'postgresql://user:pass@localhost:5432/fridgemate'
      }
    });

    expect(validateServerConfig({ exitOnError: false })).not.toContain(
      'REDIS_URL is required for a production Node server.'
    );
  });

  it('rejects unsupported SameSite values', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.AUTH_COOKIE_SAME_SITE = 'invalid';
    const { validateServerConfig } = await import('../config.js');

    expect(validateServerConfig({ exitOnError: false })).toContain(
      'AUTH_COOKIE_SAME_SITE must be Lax, Strict, or None.'
    );
  });

  it('requires Secure for SameSite=None cookies', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.AUTH_COOKIE_SAME_SITE = 'None';
    process.env.AUTH_COOKIE_SECURE = 'false';
    const { validateServerConfig } = await import('../config.js');

    expect(validateServerConfig({ exitOnError: false })).toContain(
      'AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAME_SITE is None.'
    );
  });

  it('requires Secure for __Host- cookie names', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.ACCESS_TOKEN_COOKIE_NAME = '__Host-fridgemate_access';
    process.env.AUTH_COOKIE_SECURE = 'false';
    const { validateServerConfig } = await import('../config.js');

    expect(validateServerConfig({ exitOnError: false })).toContain(
      'AUTH_COOKIE_SECURE must be true for __Host- cookie names.'
    );
  });
});
