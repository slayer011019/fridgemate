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
});
