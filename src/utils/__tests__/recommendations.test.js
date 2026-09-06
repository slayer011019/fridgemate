import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pantryStaples } from '../../data/pantryStaples.js';
import { adaptCatalogRecipe } from '../../features/recipes/recipeCatalogAdapter.js';
import {
  RECIPE_STATUS,
  buildRecipeRecommendations,
  explainRecipeMatch,
  getRecommendationInputState,
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
      expect(withPantry.hasCoreIngredients).toBe(true);
      expect(withPantry.canMakeNow).toBe(false);
      expect(withPantry.needsSeasonings).toBe(true);
      expect(withPantry.missingSeasonings).toEqual([getPantryStapleName('cooking-oil')]);
    });

    it('preserves separate seasoning and optional lists emitted by the real local catalog adapter', () => {
      const adaptedRecipe = adaptCatalogRecipe({
        id: 'adapter-tofu',
        name_ko: '두부 메뉴',
        required_ingredients: ['tofu'],
        optional_ingredients: ['green_onion'],
        seasoning_preset: 'doenjang_base'
      });
      const withoutPantry = explainRecipeMatch(adaptedRecipe.id, {
        recipes: [adaptedRecipe],
        fridgeIngredients: [createIngredient('두부'), createIngredient('대파')]
      });
      const withPantry = explainRecipeMatch(adaptedRecipe.id, {
        recipes: [adaptedRecipe],
        fridgeIngredients: [createIngredient('두부'), createIngredient('대파')],
        pantryItems: ['된장', '다진 마늘']
      });

      expect(withoutPantry.matchedOptional).toEqual(['대파']);
      expect(withoutPantry.missingSeasonings).toEqual(['된장', '다진 마늘']);
      expect(withoutPantry.canMakeNow).toBe(false);
      expect(withoutPantry.needsSeasonings).toBe(true);
      expect(withPantry.canMakeNow).toBe(true);
      expect(withPantry.score).toBeGreaterThan(withoutPantry.score);
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

  describe('honest preparation guidance', () => {
    const recipe = {
      id: 'preparation',
      title: '두부 달걀 볶음',
      coreIngredients: ['두부', '계란'],
      requiredGroups: [{ label: '채소 1가지', anyOf: ['양파', '대파'] }],
      requiredSeasonings: ['식용유']
    };

    function explain(fridgeIngredients = [], options = {}) {
      return explainRecipeMatch(recipe.id, { recipes: [recipe], fridgeIngredients, ...options });
    }

    it('offers browsing without personalized claims when no ingredients are registered', () => {
      const result = explain();

      expect(result).toMatchObject({
        inputState: 'empty',
        isPersonalized: false,
        canMakeNow: false,
        canMakeWithOneMore: false,
        needsSeasonings: false,
        scoreLabel: '',
        matchRateLabel: '',
        matchedCountLabel: '',
        status: RECIPE_STATUS.BROWSE
      });
      expect(result.reason).toContain('메뉴를 둘러보고');
      expect(result.reason).not.toMatch(/보유|대부분|양념만|바로/);
    });

    it('does not count consumed or unnamed fridge items as inventory', () => {
      const inactive = [createIngredient('두부', 3, true), createIngredient('  ')];

      expect(getRecommendationInputState(inactive)).toBe('empty');
      expect(explain(inactive).isPersonalized).toBe(false);
      expect(getRecommendationInputState(inactive, { pantryItems: ['식용유'] })).toBe('pantryOnly');
    });

    it('distinguishes pantry-only data and lists missing main ingredients and groups', () => {
      const result = explain([], { pantryItems: ['식용유'] });

      expect(result).toMatchObject({ inputState: 'pantryOnly', isPersonalized: true, hasCoreIngredients: false });
      expect(result.reason).toContain('팬트리 보유 정보만 반영');
      expect(result.reason).toContain('핵심 재료: 두부, 계란');
      expect(result.reason).toContain('필수 조합: 채소 1가지');
      expect(result.reason).not.toMatch(/대부분|양념만|모두 있어서/);
    });

    it('uses owned pantry flags when a pantry list is not explicitly supplied', () => {
      const ingredients = [createIngredient('두부'), createIngredient('계란'), createIngredient('양파')];
      const pantryOwnership = { 'cooking-oil': 'owned', salt: 'notOwned' };
      const result = explain(ingredients, { pantryOwnership });
      const recommendations = recommendRecipes({ recipes: [recipe], fridgeIngredients: ingredients, pantryOwnership });

      expect(result.canMakeNow).toBe(true);
      expect(recommendations[0].canMakeNow).toBe(true);
      expect(explain(ingredients, { pantryOwnership, pantryItems: [] }).canMakeNow).toBe(false);
    });

    it('reserves seasoning-only guidance for completed main ingredients and required groups', () => {
      const result = explain([createIngredient('두부'), createIngredient('계란'), createIngredient('양파')]);

      expect(result).toMatchObject({ hasCoreIngredients: true, needsSeasonings: true, canMakeNow: false });
      expect(result.status).toBe(RECIPE_STATUS.NEEDS_SEASONINGS);
      expect(result.reason).toContain('식용유 양념을 추가로 준비');

      const missingGroup = explain([createIngredient('두부'), createIngredient('계란')]);
      expect(missingGroup.needsSeasonings).toBe(false);
      expect(missingGroup.reason).toContain('필수 조합: 채소 1가지');
      expect(missingGroup.reason).toContain('양념: 식용유');
      expect(missingGroup.reason).not.toContain('필수 조합은 갖췄어요');
    });

    it('does not say one ingredient is enough when a required group or seasoning is also missing', () => {
      const missingGroup = explain([createIngredient('두부')], { pantryItems: ['식용유'] });
      const missingSeasoning = explain([createIngredient('두부'), createIngredient('양파')]);

      for (const result of [missingGroup, missingSeasoning]) {
        expect(result.missingCore).toEqual(['계란']);
        expect(result.canMakeWithOneMore).toBe(false);
        expect(result.reason).not.toContain('계란만');
      }
      expect(missingGroup.reason).toContain('필수 조합: 채소 1가지');
      expect(missingSeasoning.reason).toContain('양념: 식용유');
    });

    it('preserves preference ranking without letting preference guidance hide missing requirements', () => {
      const ingredients = [createIngredient('두부'), createIngredient('양파')];
      const baseline = explain(ingredients);
      const preferred = explain(ingredients, { preferences: { preferredIngredients: ['두부'] } });
      const disliked = explain(ingredients, { preferences: { dislikedIngredients: ['두부'] } });

      expect(preferred.score).toBeGreaterThan(baseline.score);
      expect(disliked.score).toBeLessThan(baseline.score);
      expect(preferred.preferredMatches).toEqual(['두부']);
      expect(disliked.dislikedMatches).toEqual(['두부']);
      expect(preferred.canMakeNow).toBe(false);
      expect(preferred.reason).toContain('두부 선호를 반영');
      expect(preferred.reason).toContain('핵심 재료: 계란');
      expect(preferred.reason).toContain('양념: 식용유');
    });

    it('identifies a single missing main ingredient only when every other requirement is satisfied', () => {
      const result = explain([createIngredient('두부'), createIngredient('양파')], { pantryItems: ['식용유'] });

      expect(result.canMakeWithOneMore).toBe(true);
      expect(result.canMakeNow).toBe(false);
      expect(result.reason).toContain('계란만 더 준비하면');
      expect(result.reason).toContain('분량은 조리법에서 확인');
    });

    it('identifies a single missing alternative group without pretending it is already available', () => {
      const result = explain([createIngredient('두부'), createIngredient('계란')], { pantryItems: ['식용유'] });

      expect(result.canMakeWithOneMore).toBe(true);
      expect(result.canMakeNow).toBe(false);
      expect(result.reason).toContain('채소 1가지만 더 준비하면');
    });

    it('does not count the same missing ingredient twice when it is also listed as seasoning', () => {
      const result = explainRecipeMatch(PANTRY_TOP_RECIPE.id, {
        recipes: [PANTRY_TOP_RECIPE],
        fridgeIngredients: [createIngredient('rice')]
      });

      expect(result.missingCore).toEqual([getPantryStapleName('salt')]);
      expect(result.missingSeasonings).toEqual(result.missingCore);
      expect(result.canMakeWithOneMore).toBe(true);
      expect(result.reason).toContain(`${getPantryStapleName('salt')}만 더 준비하면`);
    });

    it('confirms available ingredient kinds without claiming quantities or freshness are sufficient', () => {
      const result = explain(
        [createIngredient('두부'), createIngredient('계란'), createIngredient('양파')],
        { pantryItems: ['식용유'] }
      );

      expect(result).toMatchObject({ inputState: 'ingredients', canMakeNow: true, needsSeasonings: false });
      expect(result.reason).toContain('필수 재료와 양념의 종류를 갖췄어요');
      expect(result.reason).toContain('필요한 분량과 재료 상태');
    });

    it('does not mark an empty ingredient definition ready or produce a zero-denominator count', () => {
      const result = explainRecipeMatch('incomplete', {
        recipes: [{ id: 'incomplete', title: '미완성 메뉴', coreIngredients: [] }],
        fridgeIngredients: [createIngredient('두부')]
      });

      expect(result).toMatchObject({
        canMakeNow: false,
        hasCoreIngredients: false,
        matchedCountLabel: '',
        matchRateLabel: '',
        status: RECIPE_STATUS.INSUFFICIENT_DATA
      });
      expect(result.reason).toContain('핵심 재료 정보가 없어');
      expect(Number.isFinite(result.matchRate)).toBe(true);
    });

    it('keeps unlabeled alternative groups as real requirements', () => {
      const result = explainRecipeMatch('unlabeled', {
        recipes: [{ id: 'unlabeled', coreIngredients: ['두부'], requiredGroups: [{ anyOf: ['양파', '대파'] }] }],
        fridgeIngredients: [createIngredient('두부')]
      });

      expect(result.canMakeNow).toBe(false);
      expect(result.missingGroups).toEqual(['양파 또는 대파']);
      expect(result.reason).toContain('양파 또는 대파');
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
