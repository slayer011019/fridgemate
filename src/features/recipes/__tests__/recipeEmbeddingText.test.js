import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildClassifiedRecipeEmbeddingText,
  RECIPE_EMBEDDING_TEXT_MAX_CHARS
} from '../recipeEmbeddingText.js';

const recipe = {
  name: '김치찌개',
  category: '찌개',
  cookingMethod: '끓이기',
  tags: ['한식', '찌개', '한식']
};
const ingredients = [
  { rawName: '김치', normalizedName: '김치' },
  { rawName: '돼지고기', normalizedName: '돼지고기' },
  { rawName: '두부', normalizedName: '두부' },
  { rawName: '김치 200g', normalizedName: '김치' },
  { rawName: '다진 마늘', normalizedName: '마늘' },
  { rawName: '물', normalizedName: '물' },
  { rawText: '고명: 대파', rawName: '대파' }
];

describe('classified recipe embedding text', () => {
  it('is deterministic, deduplicated, grouped, and length bounded', () => {
    const first = buildClassifiedRecipeEmbeddingText(recipe, ingredients);
    const second = buildClassifiedRecipeEmbeddingText(recipe, [...ingredients].reverse());

    expect(first).toBe(second);
    expect(first).toContain('메뉴: 김치찌개');
    expect(first).toContain('검색재료: 김치, 돼지고기, 두부');
    expect(first).toContain('핵심재료: 김치');
    expect(first).toContain('양념: 마늘');
    expect(first).toContain('액체: 물');
    expect(first).toContain('선택/고명: 대파');
    expect(first.match(/김치/gu)).toHaveLength(3);
    expect(first.length).toBeLessThanOrEqual(RECIPE_EMBEDDING_TEXT_MAX_CHARS);
  });

  it('produces a deterministic content hash', () => {
    const text = buildClassifiedRecipeEmbeddingText(recipe, ingredients);
    const firstHash = createHash('sha256').update(text).digest('hex');
    const secondHash = createHash('sha256').update(buildClassifiedRecipeEmbeddingText(recipe, ingredients)).digest('hex');

    expect(firstHash).toBe(secondHash);
    expect(firstHash).toHaveLength(64);
  });
});
