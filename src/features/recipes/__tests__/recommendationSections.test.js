import { describe, expect, it } from 'vitest';
import { splitRecommendationsByReadiness } from '../recommendationSections.js';

describe('recommendationSections', () => {
  it('does not put recipes into buy-one-more when no core ingredients are owned', () => {
    const groups = splitRecommendationsByReadiness([
      {
        id: 'needs-one-but-no-match',
        canMakeNow: false,
        missingCore: ['계란'],
        matchedCore: [],
        matchedCount: 0,
        score: 0
      },
      {
        id: 'needs-one-with-match',
        canMakeNow: false,
        missingCore: ['대파'],
        matchedCore: ['계란'],
        matchedCount: 1,
        score: 35
      }
    ]);

    expect(groups.buyOneMore.map((recipe) => recipe.id)).toEqual(['needs-one-with-match']);
  });
});
