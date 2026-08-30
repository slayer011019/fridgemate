import { DurableObject } from 'cloudflare:workers';

const MIN_LIMIT = 1;
const MAX_LIMIT = 10_000;
const MIN_WINDOW_MS = 1_000;
const MAX_WINDOW_MS = 24 * 60 * 60 * 1000;

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
      )
    `);
  }

  consumeRateLimit({ limit, windowMs, cost = 1 } = {}) {
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

    return {
      allowed: true,
      retryAfterSeconds: 0
    };
  }
}
