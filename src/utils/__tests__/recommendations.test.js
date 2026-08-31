import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pantryStaples } from '../../data/pantryStaples.js';
import {
  RECIPE_STATUS,
  buildRecipeRecommendations,
  explainRecipeMatch,
  getTopRecommendations,
  normalizeIngredientName,
  recommendRecipes
} from '../recommendations.js';

const BASE_NOW = new Date(2026, 0, 15, 12, 0, 0, 0);

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createIngredient(name, daysUntilExpiry = 30, consumed = false) {
  return {
    id: `${name || 'empty'}-${daysUntilExpiry}-${consumed ? 'consumed' : 'active'}`,
    name,
    expiryDate: daysUntilExpiry === null ? '' : formatLocalDate(new Date(2026, 0, 15 + daysUntilExpiry, 12, 0, 0, 0)),
    consumed
  };
}

function getPantryStapleName(id) {
  return pantryStaples.find((staple) => staple.id === id)?.name || id;
}

const MOCK_RECIPES = [
  {
    id: 'ready',
    title: 'Ready Recipe',
    description: 'All core ingredients are available.',
    coreIngredients: ['계란', '밥'],
    optionalIngredients: ['김치'],
    requiredGroups: [],
    pantryIngredients: []
  },
  {
    id: 'buy-one',
    title: 'Buy One Recipe',
    description: 'Exactly one core ingredient is missing.',
    coreIngredients: ['계란', '밥', '대파'],
    optionalIngredients: [],
    requiredGroups: [],
    pantryIngredients: []
  },
  {
    id: 'use-soon',
    title: 'Use Soon Recipe',
    description: 'Uses an urgent ingredient but still needs more shopping.',
    coreIngredients: ['우유', '바나나', '식빵', '꿀'],
    optionalIngredients: ['계피'],
    requiredGroups: [],
    pantryIngredients: []
  },
  {
    id: 'optional-heavy',
    title: 'Optional Bonus Recipe',
    description: 'Optional ingredients should add a small score boost.',
    coreIngredients: ['계란', '밥'],
    optionalIngredients: ['김치', '참치캔'],
    requiredGroups: [],
    pantryIngredients: []
  },
  {
    id: 'no-match',
    title: 'No Match Recipe',
    description: 'Nothing in the fridge matches this recipe.',
    coreIngredients: ['연어', '레몬'],
    optionalIngredients: [],
    requiredGroups: [],
    pantryIngredients: []
  }
];

const PANTRY_RECIPE = {
  id: 'pantry-core',
  title: 'Pantry Core Recipe',
  description: 'Pantry staples should count as available when marked owned.',
  coreIngredients: ['rice', getPantryStapleName('salt'), getPantryStapleName('soy-sauce')],
  optionalIngredients: [getPantryStapleName('cooking-oil')],
  requiredGroups: [],
  pantryIngredients: [getPantryStapleName('salt'), getPantryStapleName('soy-sauce'), getPantryStapleName('cooking-oil')]
};

const PANTRY_TOP_RECIPE = {
  id: 'pantry-top',
  title: 'Pantry Top Recipe',
  description: 'A single pantry staple should raise the ranking when owned.',
  coreIngredients: ['rice', getPantryStapleName('salt')],
  optionalIngredients: [],
  requiredGroups: [],
  pantryIngredients: [getPantryStapleName('salt')]
};

describe('recommendation utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('normalizeIngredientName', () => {
    it('treats alias names as the same ingredient', () => {
      expect(normalizeIngredientName('계란')).toBe(normalizeIngredientName('달걀'));
      expect(normalizeIngredientName('대파')).toBe(normalizeIngredientName('파'));
    });

    it('normalizes whitespace and punctuation around alias inputs', () => {
      expect(normalizeIngredientName('  계란  ')).toBe(normalizeIngredientName('(달걀).'));
      expect(normalizeIngredientName(' 대파 ')).toBe(normalizeIngredientName('(파).'));
    });
  });

  describe('score calculation', () => {
    it('gives a high score when all core ingredients are available', () => {
      const result = explainRecipeMatch('ready', {
        recipes: MOCK_RECIPES,
        fridgeIngredients: [createIngredient('계란'), createIngredient('밥')]
      });

      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.canMakeNow).toBe(true);
      expect(result.status).toBe(RECIPE_STATUS.READY);
      expect(result.missingCore).toEqual([]);
    });

    it('gives a medium score when only some core ingredients are available', () => {
      const result = explainRecipeMatch('buy-one', {
        recipes: MOCK_RECIPES,
        fridgeIngredients: [createIngredient('계란'), createIngredient('밥')]
      });

      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(50);
      expect(result.canMakeNow).toBe(false);
      expect(result.missingCore).toEqual(['대파']);
    });

    it('gives a low score or zero when no core ingredients are available', () => {
      const result = explainRecipeMatch('no-match', {
        recipes: MOCK_RECIPES,
        fridgeIngredients: [createIngredient('계란'), createIngredient('밥')]
      });

      expect(result.score).toBe(0);
      expect(result.matchedCore).toEqual([]);
    });

    it('adds a bonus when optional ingredients are also available', () => {
      const withoutOptional = explainRecipeMatch('optional-heavy', {
        recipes: MOCK_RECIPES,
        fridgeIngredients: [createIngredient('계란'), createIngredient('밥')]
      });
      const withOptional = explainRecipeMatch('optional-heavy', {
        recipes: MOCK_RECIPES,
        fridgeIngredients: [
          createIngredient('계란'),
          createIngredient('밥'),
          createIngredient('김치'),
          createIngredient('참치캔')
        ]
      });

      expect(withOptional.score).toBeGreaterThan(withoutOptional.score);
      expect(withOptional.matchedOptional).toEqual(['김치', '참치캔']);
    });

    it('adds an urgent bonus when the recipe uses expiring ingredients', () => {
      const safeIngredients = [createIngredient('우유', 10), createIngredient('바나나', 10)];
      const urgentIngredients = [createIngredient('우유', 1), createIngredient('바나나', 10)];

      const safeResult = explainRecipeMatch('use-soon', {
        recipes: MOCK_RECIPES,
        fridgeIngredients: safeIngredients
      });
      const urgentResult = explainRecipeMatch('use-soon', {
        recipes: MOCK_RECIPES,
        fridgeIngredients: urgentIngredients
      });

      expect(urgentResult.score).toBeGreaterThan(safeResult.score);
      expect(urgentResult.urgentMatches).toContain('우유');
      expect(urgentResult.useSoon).toBe(true);
    });

    it('applies a larger penalty as more core ingredients are missing', () => {
      const oneMissing = explainRecipeMatch('buy-one', {
        recipes: MOCK_RECIPES,
        fridgeIngredients: [createIngredient('계란'), createIngredient('밥')]
      });
      const twoMissing = explainRecipeMatch('use-soon', {
        recipes: MOCK_RECIPES,
        fridgeIngredients: [createIngredient('우유', 1), createIngredient('바나나', 10)]
      });

      expect(twoMissing.missingCore.length).toBeGreaterThan(oneMissing.missingCore.length);
      expect(twoMissing.score).toBeLessThan(oneMissing.score);
    });

    it('treats owned pantry staples as available and reduces missing penalties', () => {
      const withoutPantry = explainRecipeMatch('pantry-core', {
        recipes: [PANTRY_RECIPE],
        fridgeIngredients: [createIngredient('rice')]
      });
      const withPantry = explainRecipeMatch('pantry-core', {
        recipes: [PANTRY_RECIPE],
        fridgeIngredients: [createIngredient('rice')],
        pantryItems: [getPantryStapleName('salt'), getPantryStapleName('soy-sauce')]
      });

      expect(withoutPantry.missingCore).toEqual([getPantryStapleName('salt'), getPantryStapleName('soy-sauce')]);
      expect(withPantry.missingCore).toEqual([]);
      expect(withPantry.score).toBeGreaterThan(withoutPantry.score);
      expect(withPantry.canMakeNow).toBe(true);
    });

    it('uses home priority for ranking even when display scores are both capped at 100', () => {
      const recipes = [
        { ...MOCK_RECIPES[0], id: 'lower-home', title: '가나다 메뉴', homePriority: 20 },
        { ...MOCK_RECIPES[0], id: 'higher-home', title: '하하하 메뉴', homePriority: 95 }
      ];
      const results = recommendRecipes({
        recipes,
        fridgeIngredients: [createIngredient('계란'), createIngredient('밥'), createIngredient('김치')]
      });

      expect(results.map((recipe) => recipe.id)).toEqual(['higher-home', 'lower-home']);
      expect(results.every((recipe) => recipe.score === 100)).toBe(true);
      expect(results[0].rankingScore).toBeGreaterThan(results[1].rankingScore);
    });

    it('filters an unrelated high-priority recipe before ranking when ingredients exist', () => {
      const results = recommendRecipes({
        recipes: [
          { ...MOCK_RECIPES[0], id: 'matched', homePriority: 20 },
          { ...MOCK_RECIPES[4], id: 'unrelated-popular', homePriority: 100 }
        ],
        fridgeIngredients: [createIngredient('계란'), createIngredient('밥')]
      });

      expect(results.map((recipe) => recipe.id)).toEqual(['matched']);
    });
  });

  describe('recommendation grouping', () => {
    it('places the correct recipe in the ready-now group', () => {
      const recommendations = buildRecipeRecommendations(MOCK_RECIPES, [
        createIngredient('계란'),
        createIngredient('밥'),
        createIngredient('김치')
      ]);

      const readyNow = recommendations.filter((recipe) => recipe.canMakeNow);

      expect(readyNow.map((recipe) => recipe.id)).toContain('ready');
      expect(readyNow.find((recipe) => recipe.id === 'ready')?.status).toBe(RECIPE_STATUS.READY);
    });

    it('places the correct recipe in the buy-one-more group', () => {
      const recommendations = buildRecipeRecommendations(MOCK_RECIPES, [
        createIngredient('계란'),
        createIngredient('밥')
      ]);

      const buyOneMore = recommendations.filter((recipe) => !recipe.canMakeNow && recipe.missingCore.length === 1);

      expect(buyOneMore.map((recipe) => recipe.id)).toContain('buy-one');
    });

    it('places the correct recipe in the use-soon-oriented group', () => {
      const recommendations = buildRecipeRecommendations(MOCK_RECIPES, [
        createIngredient('우유', 1),
        createIngredient('바나나', 10)
      ]);

      const useSoonGroup = recommendations.filter(
        (recipe) => !recipe.canMakeNow && recipe.missingCore.length !== 1 && recipe.score > 0 && recipe.useSoon
      );

      expect(useSoonGroup.map((recipe) => recipe.id)).toContain('use-soon');
    });

    it('keeps legacy results when pantry items are omitted and only changes ranking when they are provided', () => {
      const legacyRecommendations = buildRecipeRecommendations([PANTRY_TOP_RECIPE], [createIngredient('rice')]);
      const pantryAwareRecommendations = buildRecipeRecommendations(
        [PANTRY_TOP_RECIPE],
        [createIngredient('rice')],
        { pantryItems: [getPantryStapleName('salt')] }
      );
      const legacyTop = getTopRecommendations([PANTRY_TOP_RECIPE], [createIngredient('rice')], 1);
      const pantryAwareTop = getTopRecommendations(
        [PANTRY_TOP_RECIPE],
        [createIngredient('rice')],
        1,
        { pantryItems: [getPantryStapleName('salt')] }
      );

      expect(legacyRecommendations[0].missingCore).toEqual([getPantryStapleName('salt')]);
      expect(pantryAwareRecommendations[0].missingCore).toEqual([]);
      expect(pantryAwareRecommendations[0].score).toBeGreaterThan(legacyRecommendations[0].score);
      expect(legacyTop[0].missingCore).toEqual(legacyRecommendations[0].missingCore);
      expect(pantryAwareTop[0].missingCore).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('returns scored recommendations even when there are zero ingredients', () => {
      const recommendations = recommendRecipes({
        recipes: MOCK_RECIPES,
        fridgeIngredients: []
      });

      expect(recommendations).toHaveLength(MOCK_RECIPES.length);
      expect(recommendations.every((recipe) => recipe.score >= 0)).toBe(true);
    });

    it('returns an empty array when there are zero recipes', () => {
      expect(recommendRecipes({ recipes: [], fridgeIngredients: [createIngredient('계란')] })).toEqual([]);
      expect(buildRecipeRecommendations([], [createIngredient('계란')])).toEqual([]);
      expect(getTopRecommendations([], [createIngredient('계란')])).toEqual([]);
    });

    it('ignores ingredients whose names are empty strings', () => {
      const withEmptyName = explainRecipeMatch('ready', {
        recipes: MOCK_RECIPES,
        fridgeIngredients: [createIngredient(''), createIngredient('계란'), createIngredient('밥')]
      });
      const withoutEmptyName = explainRecipeMatch('ready', {
        recipes: MOCK_RECIPES,
        fridgeIngredients: [createIngredient('계란'), createIngredient('밥')]
      });

      expect(withEmptyName.score).toBe(withoutEmptyName.score);
      expect(withEmptyName.matchedCore).toEqual(withoutEmptyName.matchedCore);
    });

    it('returns null when explainRecipeMatch cannot find the recipe', () => {
      expect(
        explainRecipeMatch('missing-id', {
          recipes: MOCK_RECIPES,
          fridgeIngredients: [createIngredient('계란')]
        })
      ).toBeNull();
    });

    it('returns only positive-score recipes from getTopRecommendations', () => {
      const top = getTopRecommendations(MOCK_RECIPES, [createIngredient('계란'), createIngredient('밥')], 3);

      expect(top.length).toBeLessThanOrEqual(3);
      expect(top.every((recipe) => recipe.score > 0)).toBe(true);
    });
  });
});
