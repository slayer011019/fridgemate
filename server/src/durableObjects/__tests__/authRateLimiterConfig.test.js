import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'server/src/durableObjects/authRateLimiter.js'),
  'utf8'
);

describe('AuthRateLimiter configuration', () => {
  it('accepts the largest configured application rate limit', () => {
    const maxLimit = Number(source.match(/const MAX_LIMIT = ([\d_]+);/)?.[1].replaceAll('_', ''));
    expect(maxLimit).toBeGreaterThanOrEqual(20_000);
  });
});
