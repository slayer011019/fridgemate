import { describe, expect, it } from 'vitest';
import { getPublicRecipeByPath } from '../publicRecipeCatalog';
import { featuredRecipeEditorials, getRecipeEditorial } from '../recipeEditorialContent';
import { getGuideBySlug, getIngredientHubBySlug } from '../recipeContentHubs';

describe('source-backed recipe selection content', () => {
  it('connects six reviewed recipes to their actual public source pages', () => {
    expect(featuredRecipeEditorials.map((entry) => entry.recipeId).sort()).toEqual(['28', '282', '32', '38', '674', '91']);
    featuredRecipeEditorials.forEach((entry) => {
      expect(getPublicRecipeByPath(entry.path)).toBe(entry.recipe);
      expect(entry.recipe.externalId).toBe(entry.recipeId);
      expect(getRecipeEditorial(entry.recipe)).toBe(entry);
      expect(entry.reviewedAt).toBe('2026-09-06');
      entry.relatedRecipeIds.forEach((id) => expect(getRecipeEditorial(id)).not.toBeNull());
    });
    expect(getRecipeEditorial(null)).toBeNull();
    expect(getRecipeEditorial('not-a-recipe')).toBeNull();
  });

  it('preserves important source distinctions instead of assuming substitutions or omissions', () => {
    expect(getRecipeEditorial('28').ingredients.find((item) => item.name === '연두부')).toMatchObject({ amount: '75g', aliases: [] });
    expect(getRecipeEditorial('32').ingredients.find((item) => item.name === '순두부')).toMatchObject({ amount: '40g', aliases: [] });
    expect(getRecipeEditorial('32').ingredients.find((item) => item.name === '소금').amount).toContain('원문 분량 없음');
    expect(getRecipeEditorial('32').recipe.steps[1].text).toContain('소금');
    expect(getRecipeEditorial('91').ingredients.find((item) => item.name === '올리브유').amount).toBe('구이 10g + 소스 2g');
    expect(getRecipeEditorial('282').ingredients.find((item) => item.name === '미나리').role).toBe('main');
    expect(getRecipeEditorial('282').ingredients.find((item) => item.name === '저염된장').aliases).not.toContain('된장');
    expect(getRecipeEditorial('674').ingredients.find((item) => item.name === '두부').aliases).not.toContain('연두부');
  });

  it.each(['tofu', 'mushroom'])('compares three real recipes within the %s hub', (slug) => {
    const hub = getIngredientHubBySlug(slug);
    expect(hub.comparison.rows).toHaveLength(3);
    hub.comparison.rows.forEach((row) => {
      expect(hub.recipes).toContain(row.editorial.recipe);
      expect(row.editorial.equipment.length).toBeGreaterThan(0);
    });
  });

  it('finishes the cleanout example with the missing peanut amount and no invented pantry ownership', () => {
    const example = getGuideBySlug('fridge-cleanout').example;
    expect(example.selectedRecipe.recipe.name).toBe('순두부 사과 소스 오이무침');
    expect(example.selectedRecipe.missingIngredients).toEqual([
      expect.objectContaining({ name: '다진 땅콩', amount: '10g' })
    ]);
    const alternative = example.candidates.find((candidate) => candidate.recipeId === '282');
    expect(alternative.missingIngredients.map((item) => item.name)).toContain('저염된장');
    expect(alternative.missingIngredients.map((item) => item.name)).not.toContain('순두부');
    const href = new URL(example.selectedRecipe.examplePath, 'https://example.test');
    expect(href.searchParams.get('have')).toBe('순두부,오이,사과,소금');
  });

  it('does not count a different mushroom or tofu type as present in the priority example', () => {
    const example = getGuideBySlug('use-expiring-ingredients').example;
    expect(example.selectedRecipe.recipe.name).toBe('감자느타리버섯국');
    expect(example.selectedRecipe.missingIngredients).toEqual([
      expect.objectContaining({ name: '소금', amount: '0.5g' })
    ]);
    const alternative = example.candidates.find((candidate) => candidate.recipeId === '282');
    expect(alternative.missingIngredients.map((item) => item.name)).toEqual(expect.arrayContaining(['표고버섯', '순두부', '저염국간장']));
    expect(alternative.missingIngredients.map((item) => item.name)).not.toContain('물');
  });
});
