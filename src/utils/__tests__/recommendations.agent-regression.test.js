import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RECIPE_STATUS, explainRecipeMatch, normalizeIngredientName } from '../recommendations.js';

const BASE_NOW = new Date(2026, 0, 15, 12, 0, 0, 0);

// Policy change: outputs recorded by the existing tests are not a historical
// product specification. A main/required-seasoning collision now belongs only
// to the main group for recommendation calculation and missing-item guidance.
// Optional, liquid and unknown collisions are deliberately outside this suite.
const SCENARIOS = [
  {
    name: 'duplicate missing, other seasoning owned',
    pantryItems: ['식용유'],
    missingCore: ['소금'],
    missingSeasonings: [],
    canMakeNow: false,
    canMakeWithOneMore: true,
    needsSeasonings: false,
    status: RECIPE_STATUS.NEEDS_CORE
  },
  {
    name: 'duplicate missing, other seasoning missing',
    pantryItems: [],
    missingCore: ['소금'],
    missingSeasonings: ['식용유'],
    canMakeNow: false,
    canMakeWithOneMore: false,
    needsSeasonings: false,
    status: RECIPE_STATUS.NEEDS_CORE
  },
  {
    name: 'duplicate owned, other seasoning missing',
    pantryItems: ['소금'],
    missingCore: [],
    missingSeasonings: ['식용유'],
    canMakeNow: false,
    canMakeWithOneMore: false,
    needsSeasonings: true,
    status: RECIPE_STATUS.NEEDS_SEASONINGS
  },
  {
    name: 'duplicate owned, other seasoning owned',
    pantryItems: ['소금', '식용유'],
    missingCore: [],
    missingSeasonings: [],
    canMakeNow: true,
    canMakeWithOneMore: false,
    needsSeasonings: false,
    status: RECIPE_STATUS.READY
  }
];

function makeRecipe(seasoningField, duplicateName) {
  return {
    id: 'main-first-regression',
    title: '핵심 재료 우선 정책 검증',
    homePriority: 0,
    coreIngredients: ['밥', '소금'],
    optionalIngredients: [],
    requiredGroups: [],
    [seasoningField]: duplicateName ? [duplicateName, '식용유'] : ['식용유']
  };
}

function explain(recipe, pantryItems) {
  // Explicit pantry input avoids ownership defaults. All calls use identical
  // inventory, expiry, time and priority; no preference input is supplied.
  return explainRecipeMatch(recipe.id, {
    recipes: [recipe],
    fridgeIngredients: [{ id: 'rice', name: '밥', expiryDate: '2026-02-14', consumed: false }],
    pantryItems: [...pantryItems]
  });
}

function recommendationOutput(result) {
  // Compare public recommendation output, not recipe source arrays: original
  // culinary roles/quantities must not be erased to satisfy the comparison.
  return {
    score: result.score,
    rankingScore: result.rankingScore,
    matchRate: result.matchRate,
    missingCore: result.missingCore,
    missingIngredients: result.missingIngredients,
    missingSeasonings: result.missingSeasonings,
    matchedCore: result.matchedCore,
    matchedSeasonings: result.matchedSeasonings,
    matchedCount: result.matchedCount,
    totalRequiredIngredients: result.totalRequiredIngredients,
    hasCoreIngredients: result.hasCoreIngredients,
    canMakeNow: result.canMakeNow,
    canMakeWithOneMore: result.canMakeWithOneMore,
    needsSeasonings: result.needsSeasonings,
    status: result.status,
    reason: result.reason
  };
}

describe('agent regression: main ingredients take precedence over required seasonings', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe.each(['requiredSeasonings', 'pantryIngredients'])('%s', (seasoningField) => {
    it.each(SCENARIOS)('protects non-duplicate inputs and equivalent typed representation: $name', (scenario) => {
      const recipe = makeRecipe(seasoningField);
      // Same classification as the split representation: rice/salt are main,
      // oil is seasoning. Do not compare differently classified ingredients.
      const typedRecipe = {
        id: recipe.id,
        title: recipe.title,
        homePriority: 0,
        requiredGroups: [],
        ingredients: [
          { rawName: '밥', ingredientType: 'main', quantity: '1공기' },
          { rawName: '소금', ingredientType: 'main', quantity: '1g' },
          { rawName: '식용유', ingredientType: 'seasoning', quantity: '5g' }
        ]
      };
      const sourceBefore = structuredClone(typedRecipe);
      const result = explain(recipe, scenario.pantryItems);
      const typedResult = explain(typedRecipe, scenario.pantryItems);

      expect(result).toMatchObject({
        missingCore: scenario.missingCore,
        missingSeasonings: scenario.missingSeasonings,
        canMakeNow: scenario.canMakeNow,
        canMakeWithOneMore: scenario.canMakeWithOneMore,
        needsSeasonings: scenario.needsSeasonings,
        status: scenario.status,
        totalRequiredIngredients: 2
      });
      expect(recommendationOutput(typedResult)).toEqual(recommendationOutput(result));
      expect(typedRecipe).toEqual(sourceBefore);
    });

    describe.each([
      { kind: 'same name', duplicateName: '소금' },
      { kind: 'existing alias with whitespace/punctuation', duplicateName: ' (salt). ' }
    ])('$kind', ({ duplicateName }) => {
      it.each(SCENARIOS)('matches non-duplicate score, guidance and readiness: $name', (scenario) => {
        expect(normalizeIngredientName(duplicateName)).toBe(normalizeIngredientName('소금'));
        const cleanRecipe = makeRecipe(seasoningField);
        const duplicateRecipe = makeRecipe(seasoningField, duplicateName);
        const sourceBefore = structuredClone(duplicateRecipe);
        const expected = explain(cleanRecipe, scenario.pantryItems);
        const actual = explain(duplicateRecipe, scenario.pantryItems);

        // Soft assertions reveal score AND missing-item differences in one run;
        // they still fail the test and are never skips or expected-failure flags.
        expect.soft(recommendationOutput(actual)).toEqual(recommendationOutput(expected));
        expect.soft(actual.missingCore).toEqual(scenario.missingCore);
        expect.soft(actual.missingSeasonings).toEqual(scenario.missingSeasonings);
        expect.soft(actual.canMakeNow).toBe(scenario.canMakeNow);
        expect.soft(actual.canMakeWithOneMore).toBe(scenario.canMakeWithOneMore);
        expect.soft(actual.needsSeasonings).toBe(scenario.needsSeasonings);
        expect.soft(actual.status).toBe(scenario.status);
        expect(duplicateRecipe).toEqual(sourceBefore);
      });
    });
  });
});
