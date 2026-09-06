import { describe, expect, it } from 'vitest';
import {
  getPublicRecipeByPath,
  getPublicRecipeBySlug,
  getPublicRecipeDescription,
  getPublicRecipePath,
  getRecipeIngredientLines,
  publicRecipeCatalog,
  PUBLIC_RECIPE_PATHS
} from '../publicRecipeCatalog';

describe('publicRecipeCatalog', () => {
  it('contains a bounded source-backed catalog with unique stable paths', () => {
    expect(publicRecipeCatalog).toHaveLength(100);
    expect(new Set(PUBLIC_RECIPE_PATHS).size).toBe(publicRecipeCatalog.length);

    publicRecipeCatalog.forEach((recipe) => {
      expect(recipe.source).toContain('식품의약품안전처');
      expect(recipe.sourceUrl).toMatch(/^https:\/\/www\.foodsafetykorea\.go\.kr/u);
      expect(recipe.imageLargeUrl || recipe.imageSmallUrl).toMatch(/^https:/u);
      expect(recipe.steps.length).toBeGreaterThanOrEqual(2);
      expect(recipe).not.toHaveProperty('raw');
    });
  });

  it('resolves Korean slugs and rejects malformed encodings safely', () => {
    const recipe = publicRecipeCatalog[0];
    const path = getPublicRecipePath(recipe);

    expect(getPublicRecipeByPath(path)).toEqual(recipe);
    expect(getPublicRecipeBySlug(path.slice('/recipes/'.length))).toEqual(recipe);
    expect(getPublicRecipeBySlug('%E0%A4%A')).toBeNull();
  });

  it('removes a duplicated recipe-name heading from ingredient lines', () => {
    const recipe = publicRecipeCatalog[0];
    const ingredients = getRecipeIngredientLines(recipe);

    expect(ingredients.length).toBeGreaterThan(0);
    expect(ingredients[0]).not.toBe(recipe.name);
    expect(getPublicRecipeDescription(recipe)).toContain(`${recipe.steps.length}단계`);
  });
});
