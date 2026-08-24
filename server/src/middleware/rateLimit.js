import { serverConfig } from '../config.js';
import { consumeAuthRateLimit } from '../services/authSecurityStore.js';

export function getClientAddress(request) {
  if (serverConfig.runtime === 'cloudflare') {
    return String(request.headers?.['cf-connecting-ip'] || request.ip || 'unknown').trim();
  }

  return String(request.ip || request.socket?.remoteAddress || 'unknown').trim();
}

export function createRateLimit({ scope, limit, windowMs, key, message }) {
  return async function rateLimit(request, response, next) {
    const keyValue = String(key(request) || '').trim() || 'unknown';

    try {
      const result = await consumeAuthRateLimit({ scope, key: keyValue, limit, windowMs });

      if (!result.allowed) {
        response.setHeader('Retry-After', String(result.retryAfterSeconds));
        response.status(429).json({ message });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
