import { createClient } from 'redis';
import { serverConfig } from '../config.js';

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
    async consumeRateLimit({ scope, key, limit, windowMs }) {
      const storeKey = `${scope}:${key}`;
      const now = Date.now();
      const existingWindow = rateLimitStore.get(storeKey);
      const windowState =
        !existingWindow || existingWindow.resetTime <= now
          ? { count: 0, resetTime: now + windowMs }
          : existingWindow;

      rateLimitStore.set(storeKey, windowState);

      if (windowState.count >= limit) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((windowState.resetTime - now) / 1000))
        };
      }

      windowState.count += 1;

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

function createKvStore(kv) {
  const prefix = serverConfig.authRedisPrefix;

  return {
    mode: 'kv',
    async connect() {},
    async disconnect() {},
    async consumeRateLimit({ scope, key, limit, windowMs }) {
      const storeKey = `${prefix}:ratelimit:${scope}:${key}`;
      const now = Date.now();
      const existingWindow = await kv.get(storeKey, 'json');
      const windowState =
        !existingWindow || existingWindow.resetTime <= now
          ? { count: 0, resetTime: now + windowMs }
          : existingWindow;

      if (windowState.count >= limit) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((windowState.resetTime - now) / 1000))
        };
      }

      windowState.count += 1;
      await kv.put(storeKey, JSON.stringify(windowState), {
        expirationTtl: Math.max(60, Math.ceil(windowMs / 1000))
      });

      return { allowed: true, retryAfterSeconds: 0 };
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
    async consumeRateLimit({ scope, key, limit, windowMs }) {
      const redisKey = `${redisPrefix}:ratelimit:${scope}:${key}`;
      const currentCount = await client.incr(redisKey);

      if (currentCount === 1) {
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
let fallbackStore = activeStore;

async function switchToMemoryStore(error) {
  if (configuredMode === 'memory') {
    return;
  }

  console.error(`Persistent auth store failed during runtime, falling back to memory: ${error.message}`);

  try {
    await activeStore.disconnect();
  } catch (disconnectError) {
    console.error(`Redis auth store disconnect failed: ${disconnectError.message}`);
  }

  fallbackStore = createMemoryStore();
  activeStore = fallbackStore;
  configuredMode = 'memory';
}

async function runWithFallback(operation) {
  try {
    return await operation(activeStore);
  } catch (error) {
    if (configuredMode === 'memory') {
      throw error;
    }

    await switchToMemoryStore(error);
    return operation(activeStore);
  }
}

export async function initializeAuthSecurityStore({ kv } = {}) {
  if (kv) {
    activeStore = createKvStore(kv);
    fallbackStore = createMemoryStore();
    configuredMode = 'kv';
    return configuredMode;
  }

  if (!serverConfig.redisUrl) {
    return activeStore.mode;
  }

  const redisStore = createRedisStore();

  try {
    await redisStore.connect();
    activeStore = redisStore;
    fallbackStore = createMemoryStore();
    configuredMode = 'redis';
    return configuredMode;
  } catch (error) {
    console.error(`Redis auth store unavailable, falling back to memory: ${error.message}`);
    activeStore = createMemoryStore();
    fallbackStore = activeStore;
    configuredMode = 'memory';
    return configuredMode;
  }
}

export async function shutdownAuthSecurityStore() {
  await activeStore.disconnect();
}

export async function consumeAuthRateLimit(options) {
  return runWithFallback((store) => store.consumeRateLimit(options));
}

export async function revokeAuthToken(jti, exp) {
  return runWithFallback((store) => store.revokeToken(jti, exp));
}

export async function checkRevokedToken(jti) {
  return runWithFallback((store) => store.isTokenRevoked(jti));
}

export function getAuthSecurityStoreMode() {
  return configuredMode;
}

export function resetAuthSecurityStoreForTests() {
  if (typeof activeStore.clear === 'function') {
    activeStore.clear();
  }

  activeStore = createMemoryStore();
  fallbackStore = activeStore;
  configuredMode = 'memory';
}

export function setAuthSecurityStoreForTests(store, mode = 'memory') {
  activeStore = store;
  configuredMode = mode;
}
