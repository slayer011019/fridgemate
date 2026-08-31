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
    delete process.env.RECOMMENDATION_EVENTS_ENABLED;
    delete process.env.PRODUCT_EVENTS_ENABLED;
    delete process.env.IMPORT_CORRECTION_LEARNING_ENABLED;
    delete process.env.IMPORT_CORRECTION_EMBEDDING_ENABLED;
    delete process.env.EXTERNAL_AI_DATA_PROCESSING_ENABLED;
    delete process.env.JWT_EXPIRES_IN;
    delete process.env.REFRESH_TOKEN_EXPIRES_IN;
    delete process.env.JWT_REFRESH_EXPIRES_IN;
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

  it('fails closed for public signup in production unless explicitly enabled', async () => {
    let configModule = await import('../config.js');
    expect(configModule.serverConfig.publicSignupEnabled).toBe(false);

    process.env.PUBLIC_SIGNUP_ENABLED = '1';
    vi.resetModules();
    configModule = await import('../config.js');
    expect(configModule.serverConfig.publicSignupEnabled).toBe(false);

    process.env.PUBLIC_SIGNUP_ENABLED = 'true';
    vi.resetModules();
    configModule = await import('../config.js');
    expect(configModule.serverConfig.publicSignupEnabled).toBe(true);
  });

  it('uses explicit short access-token and refresh-token defaults', async () => {
    const { serverConfig, validateServerConfig } = await import('../config.js');

    expect(serverConfig).toMatchObject({
      jwtExpiresIn: '15m',
      refreshTokenExpiresIn: '30d'
    });
    expect(validateServerConfig({ exitOnError: false })).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/EXPIRES_IN/)])
    );
  });

  it('rejects malformed access-token and refresh-token durations at startup', async () => {
    process.env.JWT_EXPIRES_IN = '15 minutes';
    process.env.REFRESH_TOKEN_EXPIRES_IN = '30';
    const { validateServerConfig } = await import('../config.js');

    expect(validateServerConfig({ exitOnError: false })).toEqual(
      expect.arrayContaining([
        'JWT_EXPIRES_IN must be a positive integer followed by s, m, h, or d.',
        'REFRESH_TOKEN_EXPIRES_IN (or JWT_REFRESH_EXPIRES_IN) must be a positive integer followed by s, m, h, or d.'
      ])
    );
  });

  it('terminates Node startup when a token duration is malformed', async () => {
    process.env.JWT_EXPIRES_IN = 'seven-days';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.ALLOWED_ORIGINS = 'https://app.example.com';
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { validateServerConfig } = await import('../config.js');

    try {
      validateServerConfig();

      expect(errorSpy).toHaveBeenCalledWith(
        'JWT_EXPIRES_IN must be a positive integer followed by s, m, h, or d.'
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('rejects an explicitly empty duration instead of treating it as unset', async () => {
    process.env.JWT_EXPIRES_IN = '';
    const { validateServerConfig } = await import('../config.js');

    expect(validateServerConfig({ exitOnError: false })).toContain(
      'JWT_EXPIRES_IN must be a positive integer followed by s, m, h, or d.'
    );
  });

  it('validates the supported JWT refresh expiry alias', async () => {
    process.env.JWT_REFRESH_EXPIRES_IN = 'thirty-days';
    const { serverConfig, validateServerConfig } = await import('../config.js');

    expect(serverConfig.refreshTokenExpiresIn).toBe('thirty-days');
    expect(validateServerConfig({ exitOnError: false })).toContain(
      'REFRESH_TOKEN_EXPIRES_IN (or JWT_REFRESH_EXPIRES_IN) must be a positive integer followed by s, m, h, or d.'
    );
  });

  it('accepts explicit valid custom token durations', async () => {
    process.env.JWT_EXPIRES_IN = '45m';
    process.env.REFRESH_TOKEN_EXPIRES_IN = '90d';
    const { serverConfig, validateServerConfig } = await import('../config.js');

    expect(serverConfig).toMatchObject({
      jwtExpiresIn: '45m',
      refreshTokenExpiresIn: '90d'
    });
    expect(validateServerConfig({ exitOnError: false })).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/EXPIRES_IN/)])
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

  it('loads metadata-only API and AI usage telemetry settings', async () => {
    process.env.AI_USAGE_LOGGING_ENABLED = 'true';
    process.env.SEMANTIC_RECIPE_API_ENABLED = 'true';
    process.env.API_SLOW_REQUEST_MS = '900';
    process.env.RECIPE_EMBEDDING_PRICE_PER_MILLION_TOKENS = '0.02';
    const { serverConfig } = await import('../config.js');

    expect(serverConfig).toMatchObject({
      aiUsageLoggingEnabled: true,
      semanticRecipeApiEnabled: true,
      apiSlowRequestMs: 900,
      recipeEmbeddingPricePerMillionTokens: 0.02
    });
  });

  it('enables recommendation event storage only for an explicit true value', async () => {
    let configModule = await import('../config.js');
    expect(configModule.serverConfig.recommendationEventsEnabled).toBe(false);

    process.env.RECOMMENDATION_EVENTS_ENABLED = '1';
    vi.resetModules();
    configModule = await import('../config.js');
    expect(configModule.serverConfig.recommendationEventsEnabled).toBe(false);

    process.env.RECOMMENDATION_EVENTS_ENABLED = 'true';
    vi.resetModules();
    configModule = await import('../config.js');
    expect(configModule.serverConfig.recommendationEventsEnabled).toBe(true);
  });

  it('enables product event storage only for an explicit true value', async () => {
    let configModule = await import('../config.js');
    expect(configModule.serverConfig.productEventsEnabled).toBe(false);

    process.env.PRODUCT_EVENTS_ENABLED = '1';
    vi.resetModules();
    configModule = await import('../config.js');
    expect(configModule.serverConfig.productEventsEnabled).toBe(false);

    process.env.PRODUCT_EVENTS_ENABLED = 'true';
    vi.resetModules();
    configModule = await import('../config.js');
    expect(configModule.serverConfig.productEventsEnabled).toBe(true);
  });

  it('requires separate explicit opt-ins for correction storage and embeddings', async () => {
    let configModule = await import('../config.js');
    expect(configModule.serverConfig).toMatchObject({
      importCorrectionLearningEnabled: false,
      importCorrectionEmbeddingEnabled: false
    });

    process.env.IMPORT_CORRECTION_LEARNING_ENABLED = 'true';
    process.env.IMPORT_CORRECTION_EMBEDDING_ENABLED = '1';
    vi.resetModules();
    configModule = await import('../config.js');
    expect(configModule.serverConfig).toMatchObject({
      importCorrectionLearningEnabled: true,
      importCorrectionEmbeddingEnabled: false
    });

    process.env.IMPORT_CORRECTION_EMBEDDING_ENABLED = 'true';
    vi.resetModules();
    configModule = await import('../config.js');
    expect(configModule.serverConfig.importCorrectionEmbeddingEnabled).toBe(true);
  });

  it('keeps the common external AI data-processing gate fail-closed', async () => {
    let configModule = await import('../config.js');
    expect(configModule.serverConfig.externalAiDataProcessingEnabled).toBe(false);

    process.env.OPENAI_API_KEY = 'configured';
    process.env.ANTHROPIC_API_KEY = 'configured';
    process.env.SEMANTIC_RECIPE_API_ENABLED = 'true';
    process.env.IMPORT_CORRECTION_EMBEDDING_ENABLED = 'true';
    process.env.EXTERNAL_AI_DATA_PROCESSING_ENABLED = '1';
    vi.resetModules();
    configModule = await import('../config.js');
    expect(configModule.serverConfig.externalAiDataProcessingEnabled).toBe(false);

    process.env.EXTERNAL_AI_DATA_PROCESSING_ENABLED = 'true';
    vi.resetModules();
    configModule = await import('../config.js');
    expect(configModule.serverConfig.externalAiDataProcessingEnabled).toBe(true);
  });

  it('rejects wildcard and insecure CORS origins in production', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.ALLOWED_ORIGINS = 'https://app.example.com,https://*.example.com,http://admin.example.com';
    const { validateServerConfig } = await import('../config.js');

    expect(validateServerConfig({ exitOnError: false })).toContain(
      'ALLOWED_ORIGINS must contain only exact HTTPS origins in production.'
    );
  });

  it('accepts explicit HTTPS CORS origins in production', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.ALLOWED_ORIGINS = 'https://app.example.com,https://www.example.com';
    const { validateServerConfig } = await import('../config.js');

    expect(validateServerConfig({ exitOnError: false })).not.toContain(
      'ALLOWED_ORIGINS must contain only exact HTTPS origins in production.'
    );
  });
});
