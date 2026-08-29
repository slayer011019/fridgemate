import { describe, expect, it } from 'vitest';
import { mapPublicRecipe, parseArgs } from '../export-public-recipes.js';

const READY_ROW = {
  RCP_SEQ: '42',
  RCP_NM: '테스트 요리',
  RCP_WAY2: '끓이기',
  RCP_PAT2: '국&찌개',
  INFO_WGT: '200g',
  INFO_ENG: '123.4kcal',
  INFO_CAR: '10g',
  INFO_PRO: '8g',
  INFO_FAT: '4g',
  INFO_NA: '300mg',
  HASH_TAG: '#저염,#국물',
  ATT_FILE_NO_MAIN: 'http://www.foodsafetykorea.go.kr/image-small.jpg',
  ATT_FILE_NO_MK: 'https://www.foodsafetykorea.go.kr/image-large.jpg',
  RCP_PARTS_DTLS: '두부 100g\n대파 10g',
  MANUAL01: '두부를 썬다.',
  MANUAL_IMG01: 'http://www.foodsafetykorea.go.kr/step-1.jpg',
  MANUAL02: '재료를 끓인다.',
  RCP_NA_TIP: '소금은 적게 사용한다.'
};

describe('export-public-recipes', () => {
  it('maps only source-backed recipe fields and upgrades MFDS image URLs to HTTPS', () => {
    const recipe = mapPublicRecipe(READY_ROW);

    expect(recipe).toMatchObject({
      externalId: '42',
      name: '테스트 요리',
      nutrition: { calories: 123.4, sodium: 300 },
      hashTags: ['저염', '국물']
    });
    expect(recipe.steps).toHaveLength(2);
    expect(recipe.imageSmallUrl).toMatch(/^https:/u);
    expect(recipe.steps[0].imageUrl).toMatch(/^https:/u);
    expect(recipe).not.toHaveProperty('raw');
  });

  it('rejects rows without enough instructions, ingredients, or an image', () => {
    expect(mapPublicRecipe({ ...READY_ROW, MANUAL02: '' })).toBeNull();
    expect(mapPublicRecipe({ ...READY_ROW, RCP_PARTS_DTLS: '' })).toBeNull();
    expect(mapPublicRecipe({ ...READY_ROW, ATT_FILE_NO_MAIN: '', ATT_FILE_NO_MK: '' })).toBeNull();
  });

  it('rejects image URLs outside the official source host', () => {
    expect(
      mapPublicRecipe({
        ...READY_ROW,
        ATT_FILE_NO_MAIN: 'https://attacker.example/image-small.jpg',
        ATT_FILE_NO_MK: 'https://attacker.example/image-large.jpg'
      })
    ).toBeNull();
  });

  it('caps exports and requires an explicit write flag', () => {
    expect(parseArgs(['--limit=9999'])).toEqual({ write: false, limit: 500 });
    expect(parseArgs(['--limit=25', '--write'])).toEqual({ write: true, limit: 25 });
  });
});
