const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

const REQUIRED_ENV_VARS = ['JWT_SECRET', 'DATABASE_URL'];

function splitEnvList(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildOriginMatcher(pattern) {
  if (pattern === '*') return () => true;
  if (!pattern.includes('*')) return (origin) => origin === pattern;

  const regex = new RegExp(`^${pattern.split('*').map(escapeRegExp).join('.*')}$`);
  return (origin) => regex.test(origin);
}

function runtimeValue(runtimeEnv, name) {
  return runtimeEnv?.[name] ?? process.env[name];
}

function createServerConfig(runtimeEnv = process.env) {
  const configuredAllowedOrigins = splitEnvList(runtimeValue(runtimeEnv, 'ALLOWED_ORIGINS'));
  const clientOrigin = runtimeValue(runtimeEnv, 'CLIENT_ORIGIN') || 'http://localhost:5173';
  const hyperdrive = runtimeEnv?.HYPERDRIVE;
  const databaseUrl = hyperdrive ? '' : runtimeValue(runtimeEnv, 'DATABASE_URL') || '';
  const allowedOrigins = configuredAllowedOrigins.length
    ? configuredAllowedOrigins
    : uniqueValues([clientOrigin, ...DEFAULT_ALLOWED_ORIGINS]);

  return {
    runtime: hyperdrive ? 'cloudflare' : 'node',
    nodeEnv: runtimeValue(runtimeEnv, 'NODE_ENV') || 'development',
    host: runtimeValue(runtimeEnv, 'HOST') || '0.0.0.0',
    port: Number(runtimeValue(runtimeEnv, 'PORT') || 4000),
    clientOrigin,
    allowedOrigins,
    databaseUrl,
    databaseUrlProvider: hyperdrive ? () => hyperdrive.connectionString : null,
    databaseConfigured: Boolean(hyperdrive || databaseUrl),
    jwtSecret: runtimeValue(runtimeEnv, 'JWT_SECRET'),
    jwtExpiresIn: runtimeValue(runtimeEnv, 'JWT_EXPIRES_IN') || '15m',
    jwtIssuer: runtimeValue(runtimeEnv, 'JWT_ISSUER') || 'fridgemate-api',
    jwtAudience: runtimeValue(runtimeEnv, 'JWT_AUDIENCE') || 'fridgemate-client',
    refreshTokenExpiresIn: runtimeValue(runtimeEnv, 'REFRESH_TOKEN_EXPIRES_IN') || '30d',
    accessTokenCookieName: runtimeValue(runtimeEnv, 'ACCESS_TOKEN_COOKIE_NAME') || 'fridgemate_access',
    refreshTokenCookieName: runtimeValue(runtimeEnv, 'REFRESH_TOKEN_COOKIE_NAME') || 'fridgemate_refresh',
    authCookieSecure:
      String(runtimeValue(runtimeEnv, 'AUTH_COOKIE_SECURE') || runtimeValue(runtimeEnv, 'NODE_ENV') === 'production').toLowerCase() === 'true',
    authCookieSameSite: runtimeValue(runtimeEnv, 'AUTH_COOKIE_SAME_SITE') || 'Lax',
    redisUrl: runtimeValue(runtimeEnv, 'REDIS_URL') || '',
    authRedisPrefix: runtimeValue(runtimeEnv, 'AUTH_REDIS_PREFIX') || 'fridgemate:auth',
    anthropicApiKey: runtimeValue(runtimeEnv, 'ANTHROPIC_API_KEY') || '',
    openAiApiKey: runtimeValue(runtimeEnv, 'OPENAI_API_KEY') || '',
    openaiApiKey: runtimeValue(runtimeEnv, 'OPENAI_API_KEY') || '',
    recipeEmbeddingModel: runtimeValue(runtimeEnv, 'RECIPE_EMBEDDING_MODEL') || 'text-embedding-3-small',
    recipeEmbeddingDimensions: Number(runtimeValue(runtimeEnv, 'RECIPE_EMBEDDING_DIMENSIONS') || 1536),
    embeddingModel: runtimeValue(runtimeEnv, 'EMBEDDING_MODEL') || 'text-embedding-3-small',
    embeddingDimensions: Number(runtimeValue(runtimeEnv, 'EMBEDDING_DIMENSIONS') || 512)
  };
}

export const serverConfig = createServerConfig();
let allowedOriginMatchers = serverConfig.allowedOrigins.map((origin) => buildOriginMatcher(origin));

export function configureServerRuntime(runtimeEnv) {
  Object.assign(serverConfig, createServerConfig(runtimeEnv));
  allowedOriginMatchers = serverConfig.allowedOrigins.map((origin) => buildOriginMatcher(origin));
  return serverConfig;
}

export function validateServerConfig({ exitOnError = true } = {}) {
  const values = {
    JWT_SECRET: serverConfig.jwtSecret,
    DATABASE_URL: serverConfig.databaseConfigured ? 'configured' : ''
  };
  const missingEnvVars = REQUIRED_ENV_VARS.filter((name) => !String(values[name] || '').trim());
  const errors = missingEnvVars.map((name) => `${name} is required. Set it in your environment variables.`);

  if (String(serverConfig.jwtSecret || '').trim().length < 32 && !missingEnvVars.includes('JWT_SECRET')) {
    errors.push('JWT_SECRET must be at least 32 characters long.');
  }

  if (serverConfig.runtime === 'node' && serverConfig.nodeEnv === 'production' && !serverConfig.redisUrl) {
    errors.push('REDIS_URL is required for a production Node server.');
  }

  if (errors.length && exitOnError) {
    errors.forEach((message) => console.error(message));
    process.exit(1);
  }

  return errors;
}

export function isAllowedOrigin(origin) {
  if (!origin) return true;
  return allowedOriginMatchers.some((matcher) => matcher(origin));
}
