import { describe, expect, it } from 'vitest';
import {
  extractQuantity,
  isHeaderLine,
  normalizeIngredientName,
  parseFraction,
  parseIngredientChunk,
  parseIngredientsText
} from '../parse-recipe-ingredients.js';

describe('MFDS recipe ingredient parser', () => {
  it('parses unicode, slash, and decimal quantities', () => {
    expect(parseFraction('1½')).toBe(1.5);
    expect(parseFraction('3/4')).toBe(0.75);
    expect(parseFraction('12.5')).toBe(12.5);
  });

  it('extracts Korean units and preserves the ingredient name', () => {
    expect(extractQuantity('물 1½컵')).toEqual({
      amount: 1.5,
      unit: '컵',
      remainingText: '물'
    });
    expect(extractQuantity('칵테일새우 20g')).toEqual({
      amount: 20,
      unit: 'g',
      remainingText: '칵테일새우'
    });
    expect(extractQuantity('설탕 1')).toEqual({
      amount: 1,
      unit: null,
      remainingText: '설탕'
    });
  });

  it('skips recipe titles, section headers, and numeric fragments', () => {
    expect(isHeaderLine('양념장', '새우 두부 계란찜')).toMatchObject({ skip: true, reason: 'header' });
    expect(isHeaderLine('새우 두부 계란찜', '새우 두부 계란찜')).toMatchObject({
      skip: true,
      reason: 'recipe title'
    });
    expect(parseIngredientChunk('20g')).toMatchObject({ skip: true, reason: 'numeric_unit_fragment' });
  });

  it('normalizes low-salt prefixes and exact aliases', () => {
    expect(normalizeIngredientName('저염간장')).toBe('간장');
    expect(parseIngredientChunk('계란 1개')).toMatchObject({
      raw_name: '계란',
      normalized_name: '계란',
      canonical_name: '달걀',
      amount: 1,
      unit: '개',
      confidence: 0.95
    });
  });

  it('removes leading MFDS section labels before parsing ingredients', () => {
    expect(parseIngredientChunk('주재료: 쌀 90')).toMatchObject({
      raw_name: '쌀',
      normalized_name: '쌀',
      amount: 90,
      unit: null,
      confidence: 0.85
    });
    expect(parseIngredientChunk('부재료 > 아몬드가루 10g')).toMatchObject({
      raw_name: '아몬드가루',
      amount: 10,
      unit: 'g'
    });
  });

  it('keeps parenthetical display detail while using the primary amount', () => {
    expect(parseIngredientChunk('연두부 75g(3/4모)')).toMatchObject({
      raw_text: '연두부 75g(3/4모)',
      raw_name: '연두부',
      normalized_name: '연두부',
      canonical_name: '연두부 3/4모',
      amount: 75,
      unit: 'g',
      confidence: 0.95
    });
  });

  it('marks ingredient names without amounts as low confidence', () => {
    expect(parseIngredientChunk('방울토마토')).toMatchObject({
      raw_name: '방울토마토',
      normalized_name: '방울토마토',
      confidence: 0.65,
      lowConfidenceReason: 'No numeric amount detected'
    });
  });

  it('parses multiline MFDS ingredient text with skipped metadata', () => {
    const result = parseIngredientsText(
      [
        '새우 두부 계란찜',
        '재료',
        '연두부 75g(3/4모), 칵테일새우 20g(5마리), 달걀 30g(1/2개)',
        '양념장',
        '참깨 약간'
      ].join('\n'),
      '새우 두부 계란찜'
    );

    expect(result.skipped.map((item) => item.reason)).toEqual(['recipe title', 'header', 'header']);
    expect(result.chunks).toEqual([
      expect.objectContaining({ raw_name: '연두부', amount: 75, unit: 'g' }),
      expect.objectContaining({ raw_name: '칵테일새우', amount: 20, unit: 'g' }),
      expect.objectContaining({ raw_name: '달걀', amount: 30, unit: 'g' }),
      expect.objectContaining({ raw_name: '참깨', amount: null, unit: '약간', confidence: 0.8 })
    ]);
  });
});
