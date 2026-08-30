import { createRateLimit, getClientAddress } from './rateLimit.js';

const AUTHENTICATED_API_USER_REQUESTS_PER_MINUTE = 300;
const AUTHENTICATED_API_CLIENT_REQUESTS_PER_MINUTE = 6_000;
const AUTHENTICATED_API_RATE_LIMIT_MESSAGE =
  'Too many authenticated API requests. Please try again later.';

const authenticatedApiUserRateLimit = createRateLimit({
  scope: 'authenticated-api-user-minute',
  limit: AUTHENTICATED_API_USER_REQUESTS_PER_MINUTE,
  windowMs: 60 * 1000,
  key: (request) => `user:${request.auth.userId}`,
  message: AUTHENTICATED_API_RATE_LIMIT_MESSAGE
});

const authenticatedApiClientRateLimit = createRateLimit({
  scope: 'authenticated-api-client-minute',
  limit: AUTHENTICATED_API_CLIENT_REQUESTS_PER_MINUTE,
  windowMs: 60 * 1000,
  key: (request) => `client:${getClientAddress(request)}`,
  message: AUTHENTICATED_API_RATE_LIMIT_MESSAGE
});

export const authenticatedApiRateLimits = [
  authenticatedApiUserRateLimit,
  authenticatedApiClientRateLimit
];
