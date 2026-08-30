import { DurableObject } from 'cloudflare:workers';

const MIN_LIMIT = 1;
const MAX_LIMIT = 100_000;
const MIN_WINDOW_MS = 1_000;
const MAX_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_EXPIRY_SECONDS = Math.floor(Number.MAX_SAFE_INTEGER / 1_000);

function normalizeInteger(value, { min, max, name }) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }

  return number;
}

export class AuthRateLimiter extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS rate_limit_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        count INTEGER NOT NULL,
        reset_time INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS revoked_token_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        expires_at INTEGER NOT NULL
      );
    `);
  }

  async scheduleNextAlarm() {
    const rateLimitState = this.ctx.storage.sql
      .exec('SELECT reset_time AS deadline FROM rate_limit_state WHERE id = 1')
      .toArray()[0];
    const revokedTokenState = this.ctx.storage.sql
      .exec('SELECT expires_at * 1000 AS deadline FROM revoked_token_state WHERE id = 1')
      .toArray()[0];
    const deadlines = [rateLimitState?.deadline, revokedTokenState?.deadline]
      .map(Number)
      .filter((deadline) => Number.isFinite(deadline) && deadline > 0);

    if (!deadlines.length) {
      await this.ctx.storage.deleteAlarm();
      return;
    }

    await this.ctx.storage.setAlarm(Math.max(Date.now(), Math.min(...deadlines)));
  }

  async consumeRateLimit({ limit, windowMs, cost = 1 } = {}) {
    const normalizedLimit = normalizeInteger(limit, {
      min: MIN_LIMIT,
      max: MAX_LIMIT,
      name: 'limit'
    });
    const normalizedWindowMs = normalizeInteger(windowMs, {
      min: MIN_WINDOW_MS,
      max: MAX_WINDOW_MS,
      name: 'windowMs'
    });
    const normalizedCost = normalizeInteger(cost, {
      min: MIN_LIMIT,
      max: MAX_LIMIT,
      name: 'cost'
    });
    const now = Date.now();
    const currentState = this.ctx.storage.sql
      .exec('SELECT count, reset_time AS resetTime FROM rate_limit_state WHERE id = 1')
      .toArray()[0];

    if (!currentState || Number(currentState.resetTime) <= now) {
      const resetTime = now + normalizedWindowMs;

      this.ctx.storage.sql.exec(
        `
          INSERT INTO rate_limit_state (id, count, reset_time)
          VALUES (1, ?, ?)
          ON CONFLICT (id) DO UPDATE SET
            count = excluded.count,
            reset_time = excluded.reset_time
        `,
        normalizedCost <= normalizedLimit ? normalizedCost : 0,
        resetTime
      );
      await this.scheduleNextAlarm();

      return {
        allowed: normalizedCost <= normalizedLimit,
        retryAfterSeconds:
          normalizedCost <= normalizedLimit ? 0 : Math.max(1, Math.ceil((resetTime - now) / 1000))
      };
    }

    if (Number(currentState.count) + normalizedCost > normalizedLimit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((Number(currentState.resetTime) - now) / 1000))
      };
    }

    this.ctx.storage.sql.exec(
      'UPDATE rate_limit_state SET count = count + ? WHERE id = 1',
      normalizedCost
    );
    await this.scheduleNextAlarm();

    return {
      allowed: true,
      retryAfterSeconds: 0
    };
  }

  async revokeToken({ expiresAt } = {}) {
    const normalizedExpiresAt = normalizeInteger(expiresAt, {
      min: 1,
      max: MAX_EXPIRY_SECONDS,
      name: 'expiresAt'
    });

    this.ctx.storage.sql.exec(
      `
        INSERT INTO revoked_token_state (id, expires_at)
        VALUES (1, ?)
        ON CONFLICT (id) DO UPDATE SET expires_at = excluded.expires_at
      `,
      normalizedExpiresAt
    );
    await this.scheduleNextAlarm();
  }

  async isTokenRevoked() {
    const state = this.ctx.storage.sql
      .exec('SELECT expires_at AS expiresAt FROM revoked_token_state WHERE id = 1')
      .toArray()[0];
    const isActive = Number(state?.expiresAt) > Math.floor(Date.now() / 1_000);

    if (!isActive && state) {
      this.ctx.storage.sql.exec('DELETE FROM revoked_token_state WHERE id = 1');
      await this.scheduleNextAlarm();
    }

    return isActive;
  }

  async alarm() {
    const now = Date.now();
    this.ctx.storage.sql.exec('DELETE FROM rate_limit_state WHERE reset_time <= ?', now);
    this.ctx.storage.sql.exec(
      'DELETE FROM revoked_token_state WHERE expires_at <= ?',
      Math.floor(now / 1_000)
    );
    await this.scheduleNextAlarm();
  }
}
