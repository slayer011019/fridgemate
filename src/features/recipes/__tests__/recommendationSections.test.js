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

  it('does not let legacy readiness flags hide missing seasonings or zero required ingredients', () => {
    const groups = splitRecommendationsByReadiness([
      { id: 'seasonings', canMakeNow: true, missingCore: [], matchedCore: ['두부'], missingSeasonings: ['소금'] },
      { id: 'unknown-core', canMakeNow: true, totalRequiredIngredients: 0, missingCore: [] },
      { id: 'unclassified', canMakeNow: true, missingCore: [], matchedCore: ['두부'], missingUnknownIngredients: ['채소'] }
    ]);

    expect(groups.ready).toEqual([]);
    expect(groups.needsSeasonings.map((recipe) => recipe.id)).toEqual(['seasonings']);
    expect(groups.other.map((recipe) => recipe.id)).toEqual(['unknown-core', 'unclassified']);
  });

  it('requires all remaining groups and seasonings to fit the one-addition claim', () => {
    const partial = { canMakeNow: false, missingCore: ['계란'], matchedCore: ['두부'], score: 40 };
    const groups = splitRecommendationsByReadiness([
      { ...partial, id: 'group-also-missing', missingGroups: ['채소 1가지'] },
      { ...partial, id: 'seasoning-also-missing', missingSeasonings: ['소금'] },
      { ...partial, id: 'explicit-false', canMakeWithOneMore: false },
      { ...partial, id: 'same-ingredient-in-seasonings', missingSeasonings: ['계란'] },
      { ...partial, id: 'one-group', missingCore: [], missingGroups: ['채소 1가지'], canMakeWithOneMore: true }
    ]);

    expect(groups.buyOneMore.map((recipe) => recipe.id)).toEqual(['same-ingredient-in-seasonings', 'one-group']);
    expect(groups.other).toHaveLength(3);
  });

  it('shows only recipes using an expiring ingredient in the use-soon group', () => {
    const partial = { canMakeNow: false, missingCore: ['양파', '대파'], matchedCore: ['두부'], score: 30 };
    const groups = splitRecommendationsByReadiness([
      { ...partial, id: 'not-urgent' },
      { ...partial, id: 'urgent-flag', useSoon: true },
      { ...partial, id: 'urgent-match', expiringMatchedIngredients: ['두부'] },
      { ...partial, id: 'zero-score', useSoon: true, score: 0 }
    ]);

    expect(groups.useSoon.map((recipe) => recipe.id)).toEqual(['urgent-flag', 'urgent-match']);
    expect(groups.other.map((recipe) => recipe.id)).toEqual(['not-urgent', 'zero-score']);
  });

  it('keeps browsing candidates out of personalized groups and preserves ready-first ordering', () => {
    const groups = splitRecommendationsByReadiness([
      { id: 'browse', isPersonalized: false, canMakeNow: true, missingCore: [], score: 70 },
      { id: 'ready', isPersonalized: true, canMakeNow: true, missingCore: [], useSoon: true, score: 80 }
    ]);

    expect(groups.ready.map((recipe) => recipe.id)).toEqual(['ready']);
    expect(groups.useSoon).toEqual([]);
    expect(Object.values(groups).flat().some((recipe) => recipe.id === 'browse')).toBe(false);
  });
});
