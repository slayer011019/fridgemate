import { describe, expect, it } from 'vitest';
import { buildProductionRecipeEmbeddingText } from '../recipeEmbeddingTextBuilder.js';

describe('recipeEmbeddingTextBuilder', () => {
  it('builds stable text from production-shaped recipe rows', () => {
    const recipe = {
      name: 'Kimchi Fried Rice',
      dish_type: 'Rice',
      cooking_method: 'Stir-fry',
      ingredients_text: 'kimchi, rice, egg',
      steps: [{ text: 'Stir fry kimchi.' }, { text: 'Add rice and egg.' }],
      raw: { description: 'A quick leftover rice meal.' }
    };
    const ingredients = [
      { normalized_name: 'rice', category: 'grain' },
      { normalized_name: 'kimchi', category: 'vegetable' },
      { canonical_name: 'egg', category: 'protein' }
    ];

    expect(buildProductionRecipeEmbeddingText(recipe, ingredients)).toBe(
      [
        '검색재료: egg, kimchi, rice',
        '핵심재료: kimchi, rice',
        '메뉴: Kimchi Fried Rice',
        '분류: Rice',
        '조리방식: Stir-fry'
      ].join('\n')
    );
  });

  it('omits empty fields and preserves Korean UTF-8 text', () => {
    const text = buildProductionRecipeEmbeddingText(
      {
        name: '김치볶음밥',
        cooking_method: '',
        ingredients_text: '김치, 밥, 달걀'
      },
      [{ normalized_name: '김치' }, { normalized_name: '달걀' }]
    );

    expect(text).toContain('메뉴: 김치볶음밥');
    expect(text).toContain('검색재료: 계란, 김치');
    expect(text).toContain('핵심재료: 김치');
    expect(text).not.toContain('조리방식:');
    expect(text).not.toContain('원재료요약:');
    expect(text).not.toContain('Steps:');
    expect(text).not.toContain('undefined');
  });
});
