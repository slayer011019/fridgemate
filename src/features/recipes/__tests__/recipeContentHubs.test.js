import { describe, expect, it } from 'vitest';
import { getPublicRecipePath, publicRecipeCatalog } from '../publicRecipeCatalog';
import {
  getGuideByPath,
  getIngredientHubByPath,
  getIngredientHubsForRecipe,
  guidePages,
  ingredientHubs
} from '../recipeContentHubs';

describe('recipeContentHubs', () => {
  it('defines six ingredient hubs and two public guides with stable unique paths', () => {
    expect(ingredientHubs).toHaveLength(6);
    expect(guidePages).toHaveLength(2);

    const paths = [...ingredientHubs, ...guidePages].map((entry) => entry.path);
    expect(new Set(paths).size).toBe(8);
    paths.forEach((path) => expect(path).toMatch(/^\/(?:recipes\/ingredients|guides)\/[a-z-]+$/u));
  });

  it('matches only source-backed public recipes and resolves each hub by path', () => {
    const publicPaths = new Set(publicRecipeCatalog.map(getPublicRecipePath));

    ingredientHubs.forEach((hub) => {
      expect(hub.recipes.length).toBeGreaterThanOrEqual(4);
      expect(getIngredientHubByPath(hub.path)).toBe(hub);
      hub.recipes.forEach((recipe) => expect(publicPaths.has(getPublicRecipePath(recipe))).toBe(true));
    });

    guidePages.forEach((guide) => expect(getGuideByPath(guide.path)).toBe(guide));
  });

  it('provides reverse links from recipes to matching hubs', () => {
    ingredientHubs.forEach((hub) => {
      hub.recipes.forEach((recipe) => expect(getIngredientHubsForRecipe(recipe)).toContain(hub));
    });
  });
});
