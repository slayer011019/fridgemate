import { describe, expect, it } from 'vitest';
import { normalizeRecommendationEventPayload } from '../recommendationEventService.js';

const VALID_PAYLOAD = {
  eventType: 'impression',
  recipeId: 'recipe-1',
  sessionId: 'fm-1234-abcd',
  rank: 1,
  score: 85.5,
  matchRate: 75,
  missingIngredientCount: 1,
  urgentMatchCount: 2,
  canMakeNow: false,
  source: 'hybrid',
  metadata: {
    recipeName: '김치볶음밥',
    group: 'useSoon'
  }
};

describe('recommendationEventService validation', () => {
  it('keeps only the documented bounded event shape', () => {
    expect(normalizeRecommendationEventPayload(VALID_PAYLOAD)).toEqual(VALID_PAYLOAD);
  });

  it.each([
    ['unknown root fields', { ...VALID_PAYLOAD, email: 'victim@example.com' }],
    ['unknown metadata fields', { ...VALID_PAYLOAD, metadata: { raw: { arbitrary: true } } }],
    ['oversized recipe ids', { ...VALID_PAYLOAD, recipeId: 'x'.repeat(201) }],
    ['invalid session ids', { ...VALID_PAYLOAD, sessionId: 'contains spaces' }],
    ['unknown sources', { ...VALID_PAYLOAD, source: 'attacker-controlled' }],
    ['out-of-range ranks', { ...VALID_PAYLOAD, rank: 1001 }],
    ['non-boolean flags', { ...VALID_PAYLOAD, canMakeNow: 'true' }]
  ])('rejects %s', (_label, payload) => {
    expect(() => normalizeRecommendationEventPayload(payload)).toThrow();
  });
});
