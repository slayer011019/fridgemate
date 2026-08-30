import { createHash } from 'node:crypto';
import { createClient } from 'redis';
import { serverConfig } from '../config.js';

const MAX_RATE_LIMIT_COST = 10_000;

function normalizeRateLimitCost(value = 1) {
  const cost = Number(value);

  if (!Number.isInteger(cost) || cost < 1 || cost > MAX_RATE_LIMIT_COST) {
    throw new Error(`Rate limit cost must be an integer between 1 and ${MAX_RATE_LIMIT_COST}.`);
  }

  return cost;
}

function createMemoryStore() {
  const rateLimitStore = new Map();
  const revokedTokenStore = new Map();

  function cleanupRevokedTokens(nowSeconds) {
    for (const [jti, expiresAt] of revokedTokenStore.entries()) {
      if (expiresAt <= nowSeconds) {
        revokedTokenStore.delete(jti);
      }
    }
  }

  return {
    mode: 'memory',
    async connect() {},
    async disconnect() {},
    async consumeRateLimit({ scope, key, limit, windowMs, cost = 1 }) {
      const storeKey = `${scope}:${key}`;
      const requestCost = normalizeRateLimitCost(cost);
      const now = Date.now();
      const existingWindow = rateLimitStore.get(storeKey);
      const windowState =
        !existingWindow || existingWindow.resetTime <= now
          ? { count: 0, resetTime: now + windowMs }
          : existingWindow;

      rateLimitStore.set(storeKey, windowState);

      if (windowState.count + requestCost > limit) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((windowState.resetTime - now) / 1000))
        };
      }

      windowState.count += requestCost;

      return {
        allowed: true,
        retryAfterSeconds: 0
      };
    },
    async revokeToken(jti, exp) {
      const expiresAt = Number(exp);

      if (!jti || !Number.isFinite(expiresAt)) {
        return;
      }

      cleanupRevokedTokens(Math.floor(Date.now() / 1000));
      revokedTokenStore.set(jti, expiresAt);
    },
    async isTokenRevoked(jti) {
      if (!jti) {
        return false;
      }

      const nowSeconds = Math.floor(Date.now() / 1000);
      cleanupRevokedTokens(nowSeconds);
      const expiresAt = revokedTokenStore.get(jti);

      return typeof expiresAt === 'number' && expiresAt > nowSeconds;
    },
    clear() {
      rateLimitStore.clear();
      revokedTokenStore.clear();
    }
  };
}

function buildRateLimiterName(scope, key) {
  return createHash('sha256')
    .update(`${serverConfig.authRedisPrefix}:ratelimit:${scope}:${key}`)
    .digest('hex');
}

function createCloudflareStore({ kv, rateLimiter }) {
  const prefix = serverConfig.authRedisPrefix;

  return {
    mode: 'cloudflare',
    async connect() {},
    async disconnect() {},
    async consumeRateLimit({ scope, key, limit, windowMs, cost = 1 }) {
      const stub = rateLimiter.getByName(buildRateLimiterName(scope, key));
      return stub.consumeRateLimit({ limit, windowMs, cost: normalizeRateLimitCost(cost) });
    },
    async revokeToken(jti, exp) {
      const expiresAt = Number(exp);

      if (!jti || !Number.isFinite(expiresAt)) return;

      const ttlSeconds = Math.max(60, expiresAt - Math.floor(Date.now() / 1000));
      await kv.put(`${prefix}:revoked:${jti}`, '1', { expirationTtl: ttlSeconds });
    },
    async isTokenRevoked(jti) {
      if (!jti) return false;
      return (await kv.get(`${prefix}:revoked:${jti}`)) === '1';
    }
  };
}

function createRedisStore() {
  const client = createClient({
    url: serverConfig.redisUrl
  });
  const redisPrefix = serverConfig.authRedisPrefix;

  client.on('error', (error) => {
    console.error(`Redis auth store error: ${error.message}`);
  });

  return {
    mode: 'redis',
    async connect() {
      if (!client.isOpen) {
        await client.connect();
      }
    },
    async disconnect() {
      if (client.isOpen) {
        await client.quit();
      }
    },
    async consumeRateLimit({ scope, key, limit, windowMs, cost = 1 }) {
      const redisKey = `${redisPrefix}:ratelimit:${scope}:${key}`;
      const requestCost = normalizeRateLimitCost(cost);
      const currentCount = await client.incrBy(redisKey, requestCost);

      if (currentCount === requestCost) {
        await client.pExpire(redisKey, windowMs);
      }

      const ttlMs = await client.pTTL(redisKey);

      if (currentCount > limit) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil(Math.max(ttlMs, 1000) / 1000))
        };
      }

      return {
        allowed: true,
        retryAfterSeconds: 0
      };
    },
    async revokeToken(jti, exp) {
      const expiresAt = Number(exp);

      if (!jti || !Number.isFinite(expiresAt)) {
        return;
      }

      const ttlSeconds = Math.max(1, expiresAt - Math.floor(Date.now() / 1000));
      await client.set(`${redisPrefix}:revoked:${jti}`, '1', {
        EX: ttlSeconds
      });
    },
    async isTokenRevoked(jti) {
      if (!jti) {
        return false;
      }

      const value = await client.get(`${redisPrefix}:revoked:${jti}`);
      return value === '1';
    },
    async clear() {
      const keys = await client.keys(`${redisPrefix}:*`);

      if (keys.length > 0) {
        await client.del(keys);
      }
    }
  };
}

let activeStore = createMemoryStore();
let configuredMode = 'memory';

export async function initializeAuthSecurityStore({ kv, rateLimiter } = {}) {
  if (kv || rateLimiter) {
    if (!kv || !rateLimiter) {
      throw new Error('Cloudflare auth security requires both AUTH_KV and AUTH_RATE_LIMITER bindings.');
    }

    activeStore = createCloudflareStore({ kv, rateLimiter });
    configuredMode = 'cloudflare';
    return configuredMode;
  }

  if (!serverConfig.redisUrl) {
    return activeStore.mode;
  }

  const redisStore = createRedisStore();

  await redisStore.connect();
  activeStore = redisStore;
  configuredMode = 'redis';
  return configuredMode;
}

export async function shutdownAuthSecurityStore() {
  await activeStore.disconnect();
}

export async function consumeAuthRateLimit(options) {
  return activeStore.consumeRateLimit(options);
}

export async function revokeAuthToken(jti, exp) {
  return activeStore.revokeToken(jti, exp);
}

export async function checkRevokedToken(jti) {
  return activeStore.isTokenRevoked(jti);
}

export function getAuthSecurityStoreMode() {
  return configuredMode;
}

export function resetAuthSecurityStoreForTests() {
  if (typeof activeStore.clear === 'function') {
    activeStore.clear();
  }

  activeStore = createMemoryStore();
  configuredMode = 'memory';
}

export function setAuthSecurityStoreForTests(store, mode = 'memory') {
  activeStore = store;
  configuredMode = mode;
}
