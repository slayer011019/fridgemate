import { describe, expect, it } from 'vitest';
import { parseReceiptText, normalizeProductName } from '../receiptParser.js';
import { receiptRegressionFixtures } from './fixtures/receiptFixtures.js';

const TODAY = '2026-05-01';

function buildSearchText(item) {
  return [item.rawName, item.normalizedName, ...(item.sourceLines || [])].filter(Boolean).join(' ');
}

function findItemByKeywords(items, keywords) {
  return items.find((item) => {
    const searchText = buildSearchText(item);
    return keywords.every((keyword) => searchText.includes(keyword));
  });
}

function findCandidateByKeywords(candidates, keywords) {
  return candidates.find((candidate) => {
    const searchText = [candidate.name, candidate.rawName, candidate.originalText].filter(Boolean).join(' ');
    return keywords.every((keyword) => searchText.includes(keyword));
  });
}

describe('receiptParser', () => {
  it('normalizes receipt names by removing generic OCR noise instead of sample-specific mappings', () => {
    expect(normalizeProductName('* CJ 순두부 행사')).toBe('순두부');
    expect(normalizeProductName('오리훈제 슬라이스 증정')).toBe('오리훈제');
    expect(normalizeProductName('서울우유 흰우유 기획')).toBe('흰우유');
  });

  it('parses pattern A from a single line with product name, unit price, quantity, and total', () => {
    const result = parseReceiptText('테스트 우유 1,200 2 2,400', TODAY);

    expect(result.items[0]).toMatchObject({
      rawName: '테스트 우유',
      unitPrice: 1200,
      quantity: 2,
      totalPrice: 2400
    });
  });

  it('parses pattern B from separate product, price, quantity, and total lines', () => {
    const result = parseReceiptText(['테스트 두부', '2,400', '1', '2,400'].join('\n'), TODAY);

    expect(result.items[0]).toMatchObject({
      rawName: '테스트 두부',
      unitPrice: 2400,
      quantity: 1,
      totalPrice: 2400
    });
  });

  it('parses pattern C when the total price is above the product line', () => {
    const result = parseReceiptText(['8,300', '테스트 면', '4,150', '2'].join('\n'), TODAY);

    expect(result.items[0]).toMatchObject({
      rawName: '테스트 면',
      unitPrice: 4150,
      quantity: 2,
      totalPrice: 8300
    });
  });

  it('parses pattern D when the price appears above and below the product line', () => {
    const result = parseReceiptText(['7,200', '테스트 통조림', '7,200', '1'].join('\n'), TODAY);

    expect(result.items[0]).toMatchObject({
      rawName: '테스트 통조림',
      unitPrice: 7200,
      quantity: 1,
      totalPrice: 7200
    });
  });

  it('parses pattern E when the product line includes the unit price and later lines include quantity and total', () => {
    const result = parseReceiptText(['테스트 교자 기획 10,980', '1', '10,980'].join('\n'), TODAY);

    expect(result.items[0]).toMatchObject({
      rawName: '테스트 교자',
      unitPrice: 10980,
      quantity: 1,
      totalPrice: 10980,
      category: '냉동식품',
      storageType: '냉동'
    });
  });

  receiptRegressionFixtures.forEach((fixture) => {
    it(`keeps regression coverage for fixture: ${fixture.id}`, () => {
      const result = parseReceiptText(fixture.rawText, TODAY);

      expect(result.sourceType).toBe('receipt');
      expect(result.template.id).toBe('receipt-ocr');

      fixture.expectedItemKeywordGroups.forEach((keywords) => {
        expect(findItemByKeywords(result.items, keywords)).toBeTruthy();
      });

      fixture.excludedKeywords.forEach((keyword) => {
        const matchedItem = result.items.find((item) => buildSearchText(item).includes(keyword));
        expect(matchedItem).toBeUndefined();
      });

      fixture.priceAssertions.forEach((assertion) => {
        expect(findItemByKeywords(result.items, assertion.keywords)).toMatchObject({
          unitPrice: assertion.unitPrice,
          quantity: assertion.quantity,
          totalPrice: assertion.totalPrice,
          discount: assertion.discount
        });
      });

      expect(findCandidateByKeywords(result.candidates, ['왕교자'])).toMatchObject({
        selected: true,
        category: '냉동식품',
        storageType: '냉동'
      });
      expect(findCandidateByKeywords(result.candidates, ['흰우유'])).toMatchObject({
        selected: true,
        category: '유제품',
        storageType: '냉장'
      });
      expect(findCandidateByKeywords(result.candidates, ['튀김우동'])).toMatchObject({
        selected: false,
        category: '라면/면류',
        storageType: '상온'
      });
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});
