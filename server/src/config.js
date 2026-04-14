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
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || ''
};

export function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  return allowedOriginMatchers.some((matcher) => matcher(origin));
}
