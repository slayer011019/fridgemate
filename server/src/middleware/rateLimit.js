import { serverConfig } from '../config.js';
import { consumeAuthRateLimit } from '../services/authSecurityStore.js';

const MAX_RATE_LIMIT_COST = 10_000;

export function getClientAddress(request) {
  if (serverConfig.runtime === 'cloudflare') {
    return String(request.headers?.['cf-connecting-ip'] || request.ip || 'unknown').trim();
  }

  return String(request.ip || request.socket?.remoteAddress || 'unknown').trim();
}

function normalizeRateLimitCost(value) {
  const cost = Number(value);

  if (!Number.isInteger(cost) || cost < 1 || cost > MAX_RATE_LIMIT_COST) {
    throw new Error(`Rate limit cost must be an integer between 1 and ${MAX_RATE_LIMIT_COST}.`);
  }

  return cost;
}

export function createRateLimit({ scope, limit, windowMs, key, cost = () => 1, message }) {
  return async function rateLimit(request, response, next) {
    try {
      const keyValue = String(key(request) || '').trim() || 'unknown';
      const requestCost = normalizeRateLimitCost(cost(request));
      const result = await consumeAuthRateLimit({
        scope,
        key: keyValue,
        limit,
        windowMs,
        cost: requestCost
      });

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
