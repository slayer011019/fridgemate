const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

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
  jwtSecret: process.env.JWT_SECRET || 'fridgemate-dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || ''
};

export function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  return allowedOriginMatchers.some((matcher) => matcher(origin));
}
