import { describe, expect, it } from 'vitest';
import { getRecommendationEventRateLimitKey } from '../recommendationEventRoutes.js';

describe('recommendation event rate-limit key', () => {
  it('uses only userId for authenticated users behind a shared IP', () => {
    const firstUser = getRecommendationEventRateLimitKey({
      auth: { userId: 'user-1' },
      ip: '203.0.113.10'
    });
    const secondUser = getRecommendationEventRateLimitKey({
      auth: { userId: 'user-2' },
      ip: '203.0.113.10'
    });

    expect(firstUser).toBe('user:user-1');
    expect(secondUser).toBe('user:user-2');
  });

  it('uses the client address for anonymous users', () => {
    expect(getRecommendationEventRateLimitKey({ ip: '203.0.113.10' })).toBe(
      'anonymous:203.0.113.10'
    );
  });
});
