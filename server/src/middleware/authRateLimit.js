import { normalizeEmail } from '../lib/authValidation.js';
import { consumeAuthRateLimit, resetAuthSecurityStoreForTests } from '../services/authSecurityStore.js';

function normalizeKeyPart(value) {
  const normalizedValue = String(value || '').trim();
  return normalizedValue.includes('@') ? normalizeEmail(normalizedValue) : normalizedValue;
}

export function createAuthRateLimit({ scope, limit, windowMs, key }) {
  return async function authRateLimit(request, response, next) {
    const keyValue = normalizeKeyPart(key(request));

    if (!keyValue) {
      next();
      return;
    }

    try {
      const result = await consumeAuthRateLimit({
        scope,
        key: keyValue,
        limit,
        windowMs
      });

      if (!result.allowed) {
        response.setHeader('Retry-After', String(result.retryAfterSeconds));
        response.status(429).json({
          message: 'Too many authentication attempts. Please try again later.'
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function clearAuthRateLimitStore() {
  resetAuthSecurityStoreForTests();
}
