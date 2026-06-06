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
        'Title: Kimchi Fried Rice',
        'Dish type: Rice',
        'Cooking method: Stir-fry',
        'Ingredients: egg, kimchi, rice',
        'Ingredient categories: grain, protein, vegetable',
        'Raw ingredients: kimchi, rice, egg',
        'Steps: Stir fry kimchi. Add rice and egg.',
        'Description: A quick leftover rice meal.'
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

    expect(text).toContain('Title: 김치볶음밥');
    expect(text).toContain('Ingredients: 김치, 달걀');
    expect(text).not.toContain('Cooking method:');
    expect(text).not.toContain('undefined');
  });
});
