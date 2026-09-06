import { describe, expect, it } from 'vitest';
import { getPublicRecipePath, getPublicRecipeSlug, getRecipeIngredientLines, publicRecipeCatalog } from '../publicRecipeCatalog.js';
import { featuredRecipeEditorials } from '../recipeEditorialContent.js';
import {
  getPlanningRecipePath,
  getPublicRecipeForRecommendation,
  getRecipePreparationItems,
  isPreparationItemOwned,
  parsePlanningIngredients
} from '../publicRecipePlanning.js';

describe('publicRecipePlanning', () => {
  it('parses a bounded list of plain ingredient names without treating input as markup', () => {
    expect(parsePlanningIngredients(' 두부, 계란, 달걀, 다진   마늘, 다진마늘, , <script>, 간장&소스'))
      .toEqual(['두부', '계란', '다진 마늘']);
    expect(parsePlanningIngredients(Array.from({ length: 20 }, (_, index) => `재료${index}`).join(','))).toHaveLength(12);
    expect(parsePlanningIngredients(`두부,${'가'.repeat(41)},양파`)).toEqual(['두부', '양파']);
    expect(parsePlanningIngredients(null)).toEqual([]);
    expect(parsePlanningIngredients({ name: '두부' })).toEqual([]);
  });

  it('keeps exact source preparation amounts and ingredient roles for all six reviewed recipes', () => {
    expect(featuredRecipeEditorials).toHaveLength(6);
    for (const editorial of featuredRecipeEditorials) {
      const items = getRecipePreparationItems(editorial.recipe);
      expect(items.map(({ name, amount, role, aliases }) => ({ name, amount, role, aliases }))).toEqual(editorial.ingredients);
      expect(items.every((item) => item.automatic)).toBe(true);
      expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    }
  });

  it('preserves complete original lines as manual checks for all other recipes', () => {
    const reviewedIds = new Set(featuredRecipeEditorials.map((entry) => entry.recipeId));
    const unreviewed = publicRecipeCatalog.filter((recipe) => !reviewedIds.has(recipe.externalId));
    expect(unreviewed).toHaveLength(94);
    for (const recipe of unreviewed) {
      const items = getRecipePreparationItems(recipe);
      expect(items.map((item) => item.name)).toEqual(getRecipeIngredientLines(recipe));
      expect(items.every((item) => item.automatic === false && item.amount === '' && item.role === 'manual')).toBe(true);
      expect(items.every((item) => !isPreparationItemOwned(item, [item.name]))).toBe(true);
    }
  });

  it('matches only exact names, whitespace variants, and explicitly reviewed aliases', () => {
    const items = getRecipePreparationItems(publicRecipeCatalog.find((recipe) => recipe.externalId === '28'));
    expect(isPreparationItemOwned(items.find((item) => item.name === '달걀'), ['계란'])).toBe(true);
    expect(isPreparationItemOwned({ automatic: true, name: '다진 마늘', aliases: [] }, ['다진마늘'])).toBe(true);
    expect(isPreparationItemOwned({ automatic: true, name: '국멸치', aliases: ['국물용 멸치'] }, ['국물용멸치'])).toBe(true);
    expect(isPreparationItemOwned({ automatic: true, name: '두부', aliases: [] }, ['두부 100g'])).toBe(false);
  });

  it('never treats tofu, mushroom, sauce, or prepared-ingredient types as interchangeable', () => {
    for (const [required, owned] of [
      ['연두부', '두부'], ['순두부', '연두부'], ['두부', '순두부'],
      ['새송이버섯', '버섯'], ['표고버섯', '느타리버섯'], ['국간장', '간장'],
      ['저염된장', '된장'], ['다진 오이피클', '오이'], ['무염버터', '버터']
    ]) {
      expect(isPreparationItemOwned({ automatic: true, name: required, aliases: [] }, [owned]), `${required} / ${owned}`).toBe(false);
    }
  });

  it('links source-qualified external IDs and explicit public mappings to the exact catalog entry', () => {
    const recipe = publicRecipeCatalog[0];
    expect(getPublicRecipeForRecommendation(recipe)).toBe(recipe);
    expect(getPublicRecipeForRecommendation({ source: 'mfds', externalId: recipe.externalId })).toBe(recipe);
    expect(getPublicRecipeForRecommendation({ source: 'food_safety_korea', externalId: recipe.externalId })).toBe(recipe);
    expect(getPublicRecipeForRecommendation({ publicRecipeId: recipe.externalId })).toBe(recipe);
    expect(getPublicRecipeForRecommendation({ publicRecipeSlug: getPublicRecipeSlug(recipe) })).toBe(recipe);
  });

  it('links the production MFDS_COOKRCP01 source only when its external ID exists in the public catalog', () => {
    const recipe = publicRecipeCatalog.find((item) => item.externalId === '28');
    const recommendation = {
      id: '10835510-f353-451c-a8fc-f4cb70388c52',
      source: 'MFDS_COOKRCP01',
      externalId: '28',
      title: recipe.name
    };

    expect(getPublicRecipeForRecommendation(recommendation)).toBe(recipe);
    expect(getPlanningRecipePath(recommendation)).toBe(getPublicRecipePath(recipe));
    expect(getPublicRecipeForRecommendation({ ...recommendation, externalId: 'unknown' })).toBeNull();
    expect(getPublicRecipeForRecommendation({ ...recommendation, source: 'MFDS_COOKRCP02' })).toBeNull();
    expect(getPublicRecipeForRecommendation({ ...recommendation, source: '' })).toBeNull();
  });

  it('does not match local recipe titles or unqualified IDs even when they look identical', () => {
    const recipe = publicRecipeCatalog[0];
    expect(getPublicRecipeForRecommendation({ id: recipe.externalId, title: recipe.name })).toBeNull();
    expect(getPublicRecipeForRecommendation({ externalId: recipe.externalId, title: recipe.name })).toBeNull();
    expect(getPublicRecipeForRecommendation({ source: 'other', externalId: recipe.externalId })).toBeNull();
    expect(getPublicRecipeForRecommendation({ id: 'recipe-6', title: '된장국' })).toBeNull();
    expect(getPublicRecipeForRecommendation({ source: 'mfds', externalId: 'missing' })).toBeNull();
    expect(getPublicRecipeForRecommendation({ publicRecipeSlug: '%E0%A4%A' })).toBeNull();
    expect(getRecipePreparationItems({ source: 'other', externalId: '28', ingredientsText: '독립 원문 재료' }))
      .toMatchObject([{ name: '독립 원문 재료', automatic: false }]);
  });

  it('passes explicit planning names with have while leaving catalog objects unchanged', () => {
    const recipe = publicRecipeCatalog[0];
    const original = JSON.stringify(recipe);
    const pathname = getPlanningRecipePath(recipe, ['계란', '두부', '계란']);
    const url = new URL(pathname, 'https://example.com');
    expect(decodeURIComponent(url.pathname)).toBe(getPublicRecipePath(recipe));
    expect(url.searchParams.get('have')).toBe('계란,두부');
    expect(getPlanningRecipePath(recipe)).toBe(getPublicRecipePath(recipe));
    expect(getPlanningRecipePath({ title: recipe.name }, ['두부'])).toBe('');
    expect(JSON.stringify(recipe)).toBe(original);
  });
});
