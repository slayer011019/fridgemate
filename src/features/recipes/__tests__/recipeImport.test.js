import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildRecipeEmbeddingText,
  normalizeIngredientName,
  parseFoodSafetyRecipeXml,
  parseRecipeIngredients
} from '../recipeImport.js';
import { generateRecipeSearchLinks } from '../recipeSearchLinks.js';

const xmlFixture = readFileSync('src/features/recipes/__tests__/fixtures/foodSafetyRecipes.xml', 'utf8');

describe('recipe import utilities', () => {
  it('parses five rows from the XML fixture', () => {
    const recipes = parseFoodSafetyRecipeXml(xmlFixture);

    expect(recipes).toHaveLength(5);
  });

  it('maps food safety recipe fields and ignores manual fields', () => {
    const [firstRecipe] = parseFoodSafetyRecipeXml(xmlFixture);

    expect(firstRecipe).toMatchObject({
      source: 'food_safety_korea',
      sourceRecipeId: '28',
      name: '새우 두부 계란찜',
      category: '반찬',
      cookingMethod: '찌기',
      rawIngredientsText:
        '새우 두부 계란찜 연두부 75g(3/4모), 칵테일새우 20g(5마리), 달걀 30g(1/2개), 물 300ml(1½컵), 참깨 약간'
    });
    expect(Object.keys(firstRecipe).some((key) => key.startsWith('MANUAL'))).toBe(false);
    expect(firstRecipe).not.toHaveProperty('RCP_NA_TIP');
  });

  it('generates search links from the recipe name', () => {
    const recipe = parseFoodSafetyRecipeXml(xmlFixture)[0];

    expect(recipe.searchLinks).toEqual(generateRecipeSearchLinks('새우 두부 계란찜'));
    expect(recipe.searchLinks.manRecipe).toContain(encodeURIComponent('새우 두부 계란찜 레시피'));
  });

  it('builds embedding text from normalized ingredient groups', () => {
    const recipe = parseFoodSafetyRecipeXml(xmlFixture)[0];
    const embeddingText = buildRecipeEmbeddingText(recipe, recipe.ingredients);

    expect(recipe.embeddingText).toContain('메뉴: 새우 두부 계란찜');
    expect(embeddingText).toContain('핵심재료:');
    expect(embeddingText).toContain('양념재료: 참깨');
    expect(embeddingText).not.toContain('MANUAL01');
  });

  it('parses ingredient names, numeric amounts, units, and display amounts', () => {
    const tomatoSalad = parseFoodSafetyRecipeXml(xmlFixture).find((recipe) => recipe.name === '방울토마토 샐러드');
    const tomato = tomatoSalad.ingredients.find((ingredient) => ingredient.rawName === '방울토마토');

    expect(tomato).toMatchObject({
      rawName: '방울토마토',
      normalizedName: '방울토마토',
      amountText: '150g(5개)',
      amountValue: 150,
      amountUnit: 'g',
      displayAmount: '5개',
      ingredientType: 'main'
    });
  });

  it('preserves section names for sauce and garnish items', () => {
    const parsedIngredients = parseRecipeIngredients(
      '방울토마토 150g(5개), ●양념장 : 저염간장 3g(1작은술), 멸치액젓 3g(1/2작은술), ·고명 : 다진 대파 10g(1큰술)'
    );

    expect(parsedIngredients[1]).toMatchObject({
      section: '양념장',
      rawName: '저염간장',
      normalizedName: '간장',
      ingredientType: 'seasoning'
    });
    expect(parsedIngredients[3]).toMatchObject({
      section: '고명',
      rawName: '다진 대파',
      normalizedName: '대파',
      ingredientType: 'garnish'
    });
  });

  it('normalizes ingredient names with the recipe-specific cleanup rules', () => {
    expect(normalizeIngredientName('다진 마늘')).toBe('마늘');
    expect(normalizeIngredientName('칵테일새우')).toBe('새우');
    expect(normalizeIngredientName('달걀')).toBe('계란');
  });

  it('keeps rawName and amountText even when amount parsing is incomplete', () => {
    const [ingredient] = parseRecipeIngredients('참깨 약간');

    expect(ingredient.rawName).toBe('참깨');
    expect(ingredient.amountText).toBe('약간');
    expect(ingredient.displayAmount).toBe('약간');
    expect(ingredient.confidence).toBeGreaterThan(0.7);
  });
});
