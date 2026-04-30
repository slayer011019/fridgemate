const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

const REQUIRED_ENV_VARS = ['JWT_SECRET', 'DATABASE_URL'];

function splitEnvList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildOriginMatcher(pattern) {
  if (pattern === '*') {
    return () => true;
  }

  if (!pattern.includes('*')) {
    return (origin) => origin === pattern;
  }

  const regex = new RegExp(`^${pattern.split('*').map(escapeRegExp).join('.*')}$`);
  return (origin) => regex.test(origin);
}

function getMissingRequiredEnvVars() {
  return REQUIRED_ENV_VARS.filter((name) => !String(process.env[name] || '').trim());
}

function validateRequiredEnvVars() {
  const missingEnvVars = getMissingRequiredEnvVars();

  if (missingEnvVars.length === 0) {
    return;
  }

  const messages = missingEnvVars.map((name) => {
    if (name === 'JWT_SECRET') {
      return 'JWT_SECRET is required. Set it in your environment variables.';
    }

    return `${name} is required. Set it in your environment variables.`;
  });

  messages.forEach((message) => console.error(message));
  process.exit(1);
}

validateRequiredEnvVars();

if (String(process.env.JWT_SECRET || '').trim().length < 32 && process.env.NODE_ENV !== 'test') {
  console.error('JWT_SECRET must be at least 32 characters long.');
  process.exit(1);
}

const configuredAllowedOrigins = splitEnvList(process.env.ALLOWED_ORIGINS);
const fallbackAllowedOrigins = uniqueValues([process.env.CLIENT_ORIGIN, ...DEFAULT_ALLOWED_ORIGINS]);
const allowedOrigins = configuredAllowedOrigins.length ? configuredAllowedOrigins : fallbackAllowedOrigins;
const allowedOriginMatchers = allowedOrigins.map((origin) => buildOriginMatcher(origin));

export const serverConfig = {
  host: process.env.HOST || '0.0.0.0',
  port: Number(process.env.PORT || 4000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  allowedOrigins,
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtIssuer: process.env.JWT_ISSUER || 'fridgemate-api',
  jwtAudience: process.env.JWT_AUDIENCE || 'fridgemate-client',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
  accessTokenCookieName: process.env.ACCESS_TOKEN_COOKIE_NAME || 'fridgemate_access',
  refreshTokenCookieName: process.env.REFRESH_TOKEN_COOKIE_NAME || 'fridgemate_refresh',
  authCookieSecure: String(process.env.AUTH_COOKIE_SECURE || process.env.NODE_ENV === 'production').toLowerCase() === 'true',
  authCookieSameSite: process.env.AUTH_COOKIE_SAME_SITE || 'Lax',
  redisUrl: process.env.REDIS_URL || '',
  authRedisPrefix: process.env.AUTH_REDIS_PREFIX || 'fridgemate:auth',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  openAiApiKey: process.env.OPENAI_API_KEY || '',
  recipeEmbeddingModel: process.env.RECIPE_EMBEDDING_MODEL || 'text-embedding-3-small',
  recipeEmbeddingDimensions: Number(process.env.RECIPE_EMBEDDING_DIMENSIONS || 1536)
};

export function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  return allowedOriginMatchers.some((matcher) => matcher(origin));
}
