import { describe, expect, it } from 'vitest';
import {
  buildRecipeIngredientPayloadKey,
  dedupeRecipeIngredientRows,
  extractQuantity,
  isHeaderLine,
  normalizeRawText,
  normalizeIngredientName,
  parseFraction,
  parseIngredientChunk,
  parseIngredientsText,
  repairMojibakeText
} from '../parse-recipe-ingredients.js';

describe('MFDS recipe ingredient parser', () => {
  it('dedupes recipe ingredient upsert rows by recipe id and normalized raw text', () => {
    const rows = [
      {
        recipe_id: 'recipe-a',
        raw_text: 'salt   pinch',
        canonical_name: 'salt',
        confidence: 0.65
      },
      {
        recipe_id: 'recipe-a',
        raw_text: ' salt pinch ',
        canonical_name: 'fine salt',
        confidence: 0.95
      },
      {
        recipe_id: 'recipe-b',
        raw_text: 'salt pinch',
        canonical_name: 'salt',
        confidence: 0.65
      }
    ];

    const result = dedupeRecipeIngredientRows(rows);

    expect(normalizeRawText(' salt   pinch ')).toBe('salt pinch');
    expect(buildRecipeIngredientPayloadKey(rows[0])).toBe('recipe-a::salt pinch');
    expect(result.skippedCount).toBe(1);
    expect(result.rows).toHaveLength(2);
    expect(result.rows).toContain(rows[1]);
    expect(result.rows).toContain(rows[2]);
    expect(result.duplicateExamples).toEqual([
      {
        recipe_id: 'recipe-a',
        raw_text: 'salt pinch',
        kept: {
          canonical_name: 'fine salt',
          confidence: 0.95
        },
        skipped: {
          canonical_name: 'salt',
          confidence: 0.65
        }
      }
    ]);
  });

  it('keeps the first duplicate recipe ingredient row when confidence is tied', () => {
    const first = {
      recipe_id: 'recipe-a',
      raw_text: 'water 1 cup',
      canonical_name: 'water',
      confidence: 0.85
    };
    const second = {
      recipe_id: 'recipe-a',
      raw_text: ' water 1 cup ',
      canonical_name: 'filtered water',
      confidence: 0.85
    };

    const result = dedupeRecipeIngredientRows([first, second]);

    expect(result.skippedCount).toBe(1);
    expect(result.rows).toEqual([first]);
    expect(result.duplicateExamples[0]).toMatchObject({
      kept: { canonical_name: 'water', confidence: 0.85 },
      skipped: { canonical_name: 'filtered water', confidence: 0.85 }
    });
  });

  it('repairs CP949 mojibake before parsing', () => {
    expect(repairMojibakeText('\u8e30\uafa9\uaf62')).toBe('\ubc84\uc12f');
    expect(parseIngredientChunk('\u8e30\uafa9\uaf62 20g')).toMatchObject({
      raw_name: '\ubc84\uc12f',
      amount: 20,
      unit: 'g'
    });
  });

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
    expect(extractQuantity('0.5Ts')).toEqual({
      amount: 0.5,
      unit: '큰술',
      remainingText: ''
    });
  });

  it('skips recipe titles, section headers, and numeric fragments', () => {
    expect(isHeaderLine('양념장', '새우 두부 계란찜')).toMatchObject({ skip: true, reason: 'header' });
    expect(isHeaderLine('주재료', '북어비빔밥')).toMatchObject({ skip: true, reason: 'header' });
    expect(isHeaderLine('새우 두부 계란찜', '새우 두부 계란찜')).toMatchObject({
      skip: true,
      reason: 'recipe title'
    });
    expect(parseIngredientChunk('20g')).toMatchObject({ skip: true, reason: 'numeric_unit_fragment' });
    expect(parseIngredientChunk('곁들임')).toMatchObject({ skip: true, reason: 'header' });
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
    expect(parseIngredientChunk('닭고기(가슴살, 120g)')).toMatchObject({
      raw_name: '닭고기',
      normalized_name: '닭고기',
      canonical_name: '닭고기 가슴살',
      amount: 120,
      unit: 'g',
      confidence: 0.95
    });
    expect(parseIngredientChunk('소금(0.5Ts)')).toMatchObject({
      raw_name: '소금',
      normalized_name: '소금',
      amount: 0.5,
      unit: '큰술',
      confidence: 0.95
    });
  });

  it('extracts quantities from multiple or descriptive parenthetical groups', () => {
    expect(parseIngredientChunk('대파(1대)')).toMatchObject({
      raw_name: '대파',
      amount: 1,
      unit: '대'
    });
    expect(parseIngredientChunk('스파게티면(건면)(5g)')).toMatchObject({
      raw_name: '스파게티면',
      canonical_name: '스파게티면 건면',
      amount: 5,
      unit: 'g'
    });
    expect(parseIngredientChunk('달걀지단(3개 분량)')).toMatchObject({
      raw_name: '달걀지단',
      canonical_name: '달걀지단 분량',
      amount: 3,
      unit: '개'
    });
    expect(parseIngredientChunk('대파(15cm)')).toMatchObject({
      raw_name: '대파',
      amount: 15,
      unit: 'cm'
    });
    expect(parseIngredientChunk('3가지색 소면(분홍, 초록, 흰색) 각 25g씩')).toMatchObject({
      amount: 25,
      unit: 'g'
    });
  });

  it('normalizes unicode unit ligatures in parenthetical quantities', () => {
    expect(parseIngredientChunk('식용유(5㎖)')).toMatchObject({
      raw_name: '식용유',
      amount: 5,
      unit: 'ml'
    });
    expect(parseIngredientChunk('버터(10㎎)')).toMatchObject({
      raw_name: '버터',
      amount: 10,
      unit: 'mg'
    });
    expect(parseIngredientChunk('밀가루(2㎏)')).toMatchObject({
      raw_name: '밀가루',
      amount: 2,
      unit: 'kg'
    });
    expect(parseIngredientChunk('당근(3㎝)')).toMatchObject({
      raw_name: '당근',
      amount: 3,
      unit: 'cm'
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
        '연두부 75g(3/4모), 칵테일새우 20g(5마리), 달걀 30g(1/2개), 파프리카(빨강, 노랑 각 ⅓개)',
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
      expect.objectContaining({ raw_name: '파프리카', amount: 0.333, unit: '개' }),
      expect.objectContaining({ raw_name: '참깨', amount: null, unit: '약간', confidence: 0.8 })
    ]);
  });

  it('skips html-only and serving info lines', () => {
    expect(parseIngredientChunk('<br>')).toMatchObject({ skip: true, reason: 'html_tag_only' });
    expect(parseIngredientChunk('2인분 기준<br>')).toMatchObject({ skip: true, reason: 'metadata' });
  });
});
