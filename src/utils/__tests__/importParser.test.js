import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseImportText } from '../importParser.js';
import { detectOcrSourceType } from '../import/ocrSourceDetector.js';

const FIXED_NOW = new Date(Date.UTC(2026, 2, 18, 12, 0, 0, 0));
const TODAY = '2026-03-18';

const COUPANG_BASIC_TEXT = [
  '2026. 3. 18 \uC8FC\uBB38',
  '\uBC30\uC1A1\uC644\uB8CC \u00B7 3/19(\uBAA9) \uB3C4\uCC29',
  '\uB85C\uCF13\uD504\uB808\uC2DC \uAD6D\uB0B4\uC0B0 \uB450\uBD80 \uCC0C\uAC1C\uC6A9',
  '2,990\uC6D0 \u00B7 1\uAC1C',
  '\uC7A5\uBC14\uAD6C\uB2C8 \uB2F4\uAE30'
].join('\n');

const COUPANG_MULTI_PRODUCT_TEXT = [
  '2026. 3. 18 \uC8FC\uBB38',
  '\uBC30\uC1A1\uC644\uB8CC \u00B7 3/19(\uBAA9) \uB3C4\uCC29',
  '\uB85C\uCF13\uD504\uB808\uC2DC \uAD6D\uB0B4\uC0B0 \uB450\uBD80 \uCC0C\uAC1C\uC6A9 2,990\uC6D0 \u00B7 1\uAC1C \uC7A5\uBC14\uAD6C\uB2C8 \uB2F4\uAE30',
  '\uB85C\uCF13\uD504\uB808\uC2DC \uAD6D\uB0B4\uC0B0 \uC624\uC774 1,990\uC6D0 \u00B7 2\uAC1C\uC785 \uC7A5\uBC14\uAD6C\uB2C8 \uB2F4\uAE30',
  '\uACF0\uACF0 \uBB34\uD56D\uC0DD\uC81C \uB300\uB780 11,300\uC6D0 \u00B7 10\uAD6C \uC7A5\uBC14\uAD6C\uB2C8 \uB2F4\uAE30'
].join('\n');

const COUPANG_WITH_NON_PRODUCT_LINES_TEXT = [
  '2026. 3. 18 \uC8FC\uBB38',
  '\uBC30\uC1A1\uC644\uB8CC \u00B7 3/19(\uBAA9) \uB3C4\uCC29',
  '\uBC30\uC1A1\uBE44',
  '3,000\uC6D0',
  '\uD560\uC778',
  '-2,000\uC6D0',
  '\uB85C\uCF13\uD504\uB808\uC2DC \uAD6D\uB0B4\uC0B0 \uC624\uC774',
  '1,990\uC6D0 \u00B7 2\uAC1C\uC785',
  '\uC7A5\uBC14\uAD6C\uB2C8 \uB2F4\uAE30'
].join('\n');

const COLLAPSED_OCR_TEXT = [
  '2026. 3. 18 \uC8FC\uBB38',
  '\uBC30\uC1A1\uC644\uB8CC \u00B7 3/19(\uBAA9) \uB3C4\uCC29',
  '\uB85C\uCF13\uD504\uB808\uC2DC \uAD6D\uB0B4\uC0B0 \uC591\uD30C 1,280\uC6D0 \u00B7 1\uB9DD \uC7A5\uBC14\uAD6C\uB2C8 \uB2F4\uAE30',
  '\uACF0\uACF0 \uBB34\uD56D\uC0DD\uC81C \uB300\uB780 11,300\uC6D0 \u00B7 10\uAD6C \uC7A5\uBC14\uAD6C\uB2C8 \uB2F4\uAE30'
].join(' ');

const GENERIC_SINGLE_LINE_TEXT = '\uAD6D\uB0B4\uC0B0 \uC591\uD30C 1kg';
const EMPTY_TEXT = '';
const NUMERIC_ONLY_TEXT = '12345\n67890';
const NOISY_OCR_TEXT = '@@@ ### ==== 12345 !!!';
const UNKNOWN_GENERIC_TEXT = 'Fresh onion 1kg\nTotal: 3000';
const MART_RECEIPT_SAMPLE_A = [
  '트레이더스 홀세일 클럽 위례점',
  '206-86-50913 한채양 (031)8097-1234',
  '경기도 하남시 위례대로 200',
  '[구매]2026-04-24 16:15 POS:0305-5662',
  '상품명 단가 수량 금액',
  '돌얼음2.5kg 3,180 1 3,180',
  '8801114106921',
  '* 풀무원 국산두컵두부 5,480 1 5,480',
  '8801114152331',
  '* 미국산냉장초이스갈비 38,960 1 38,960',
  '1265720389674',
  '아인슈타인베이글2봉 8,980 1 8,980',
  '8809901602687',
  '필라델피아 크림치즈 8,780 1 8,780',
  '8801037008197',
  '총 품목 수량 5',
  '합계 65,380',
  '결제대상금액 65,380'
].join('\n');
const MART_RECEIPT_SAMPLE_B = [
  '상품명 단가 수량 금액',
  '오뚜기 옛날 참기름 13,780 1 13,780',
  '8801045440354',
  '신세계포인트적립할인 -3,800',
  '프라임 버터 450g*2입 10,980 1 10,980',
  '8801207160229',
  '* 미국산냉장초이스갈비 51,880 1 51,880',
  '1265720518844',
  '총 품목 수량 3',
  '합계 72,840'
].join('\n');
const KURLY_ORDER_TEXT = [
  'Kurly',
  '주문 내역 상세',
  '샛별배송',
  'KF365 무항생제 특란 10구',
  '6,980원',
  '친환경 양파 1kg',
  '4,980원',
  '전체 상품 다시 담기',
  '컬리캐시 적립'
].join('\n');

describe('parseImportText', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('coupang-like order text parsing', () => {
    it('parses a normal Coupang order text and extracts product name, quantity, and price row', () => {
      const result = parseImportText(COUPANG_BASIC_TEXT);

      expect(result.template.id).toBe('coupang-order-history');
      expect(result.candidates).toHaveLength(1);
      expect(result.rows).toHaveLength(1);

      expect(result.candidates[0]).toMatchObject({
        displayName: '\uB450\uBD80',
        normalizedName: '\uB450\uBD80',
        quantity: '1\uAC1C',
        specText: '1\uAC1C',
        purchaseDate: TODAY
      });

      expect(result.rows[0].priceLine?.line).toBe('2,990\uC6D0 \u00B7 1\uAC1C');
      expect(result.candidates[0].rawLine).toContain('2,990\uC6D0');
    });

    it('parses multiple products from one order text', () => {
      const result = parseImportText(COUPANG_MULTI_PRODUCT_TEXT);

      expect(result.template.id).toBe('coupang-order-history');
      expect(result.candidates).toHaveLength(3);
      expect(result.rows).toHaveLength(3);

      expect(result.candidates.map((candidate) => candidate.displayName)).toEqual([
        '\uB450\uBD80',
        '\uC624\uC774',
        '\uACC4\uB780'
      ]);

      expect(result.candidates.map((candidate) => candidate.quantity)).toEqual([
        '1\uAC1C',
        '2\uAC1C\uC785',
        '10\uAD6C'
      ]);
    });

    it('filters out delivery fee and discount rows when non-product lines are mixed in', () => {
      const result = parseImportText(COUPANG_WITH_NON_PRODUCT_LINES_TEXT);

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].displayName).toBe('\uC624\uC774');
      expect(result.candidates[0].quantity).toBe('2\uAC1C\uC785');
      expect(result.ignoredLines).toContain('\uBC30\uC1A1\uBE44');
      expect(result.ignoredLines).toContain('\uD560\uC778');
      expect(result.candidates[0].rawLine).not.toContain('\uBC30\uC1A1\uBE44');
      expect(result.candidates[0].rawLine).not.toContain('\uD560\uC778');
    });
  });

  describe('template detection', () => {
    it('detects Coupang-style order history text', () => {
      const result = parseImportText(COUPANG_BASIC_TEXT);

      expect(result.template).toMatchObject({
        id: 'coupang-order-history'
      });
      expect(result.template.signals.orderHeaders).toBeGreaterThan(0);
      expect(result.template.signals.deliveryHeaders).toBeGreaterThan(0);
    });

    it('falls back to generic text handling for unknown formats', () => {
      const result = parseImportText(GENERIC_SINGLE_LINE_TEXT);

      expect(result.template.id).toBe('generic-text');
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0]).toMatchObject({
        displayName: '\uC591\uD30C',
        quantity: '1kg',
        purchaseDate: TODAY
      });
    });
  });

  describe('OCR source detection routing', () => {
    it('detects Coupang, Kurly, and receipt source types before parsing', () => {
      expect(detectOcrSourceType(COUPANG_BASIC_TEXT).sourceType).toBe('coupang_order');
      expect(detectOcrSourceType(KURLY_ORDER_TEXT).sourceType).toBe('kurly_order');
      expect(detectOcrSourceType(MART_RECEIPT_SAMPLE_A).sourceType).toBe('receipt');
    });

    it('routes Kurly order text to the Kurly parser', () => {
      const result = parseImportText(KURLY_ORDER_TEXT);

      expect(result.sourceType).toBe('kurly_order');
      expect(result.template.id).toBe('kurly-order');
      expect(result.candidates.map((candidate) => candidate.displayName)).toEqual(['계란', '양파']);
      expect(result.ignoredLines).toEqual(expect.arrayContaining(['Kurly', '6,980원', '전체 상품 다시 담기']));
    });
  });

  describe('line classification and row composition', () => {
    it('distinguishes product lines from non-product lines', () => {
      const result = parseImportText(COUPANG_WITH_NON_PRODUCT_LINES_TEXT);
      const types = result.classifiedLines.map((line) => line.type);

      expect(types).toContain('orderHeader');
      expect(types).toContain('deliveryHeader');
      expect(types).toContain('brandOnly');
      expect(types).toContain('productTitle');
      expect(types).toContain('priceLine');
      expect(types).toContain('actionLine');
      expect(types).toContain('noise');
    });

    it('combines multi-line product information into a single product row', () => {
      const result = parseImportText(COUPANG_BASIC_TEXT);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].brandLine?.line).toBe('\uB85C\uCF13\uD504\uB808\uC2DC');
      expect(result.rows[0].titleLines.map((entry) => entry.line)).toEqual([
        '\uAD6D\uB0B4\uC0B0 \uB450\uBD80 \uCC0C\uAC1C\uC6A9'
      ]);
      expect(result.rows[0].priceLine?.line).toBe('2,990\uC6D0 \u00B7 1\uAC1C');
      expect(result.rows[0].actionLine?.line).toBe('\uC7A5\uBC14\uAD6C\uB2C8 \uB2F4\uAE30');
    });

    it('handles realistic collapsed OCR output by forcing breaks and parsing multiple products', () => {
      const result = parseImportText(COLLAPSED_OCR_TEXT);

      expect(result.template.id).toBe('coupang-order-history');
      expect(result.candidates).toHaveLength(2);
      expect(result.rows).toHaveLength(2);
      expect(result.candidates.map((candidate) => candidate.displayName)).toEqual([
        '\uC591\uD30C',
        '\uACC4\uB780'
      ]);
      expect(result.lines).toContain('\uC7A5\uBC14\uAD6C\uB2C8 \uB2F4\uAE30');
    });
  });

  describe('edge cases', () => {
    it('returns no candidates for an empty string', () => {
      const result = parseImportText(EMPTY_TEXT);

      expect(result.template.id).toBe('generic-text');
      expect(result.lines).toEqual([]);
      expect(result.candidates).toEqual([]);
      expect(result.rows).toEqual([]);
    });

    it('treats numeric-only lines as noise', () => {
      const result = parseImportText(NUMERIC_ONLY_TEXT);

      expect(result.candidates).toEqual([]);
      expect(result.classifiedLines.map((line) => line.type)).toEqual(['noise', 'noise']);
      expect(result.ignoredLines).toEqual(['12345', '67890']);
    });

    it('ignores OCR noise with heavy special characters', () => {
      const result = parseImportText(NOISY_OCR_TEXT);

      expect(result.template.id).toBe('generic-text');
      expect(result.candidates).toEqual([]);
      expect(result.classifiedLines[0]).toMatchObject({
        type: 'noise',
        line: '@@@ ### ==== 12345 !!!'
      });
    });

    it('supports a single-line fallback input', () => {
      const result = parseImportText(GENERIC_SINGLE_LINE_TEXT);

      expect(result.template.id).toBe('generic-text');
      expect(result.lines).toEqual([GENERIC_SINGLE_LINE_TEXT]);
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].displayName).toBe('\uC591\uD30C');
      expect(result.candidates[0].quantity).toBe('1kg');
    });

    it('extracts common OCR unit variants', () => {
      const quantities = ['양파 1㎏', '대파 1단', '감자 2키로'].map((text) => parseImportText(text).candidates[0]?.quantity);

      expect(quantities).toEqual(['1kg', '1단', '2kg']);
    });

    it('keeps unknown generic multi-line text in fallback mode without creating invalid candidates', () => {
      const result = parseImportText(UNKNOWN_GENERIC_TEXT);

      expect(result.template.id).toBe('generic-text');
      expect(result.candidates).toEqual([]);
      expect(result.ignoredLines).toEqual(['Fresh onion 1kg', 'Total: 3000']);
    });
  });

  describe('mart receipt OCR parsing', () => {
    it('extracts only product rows from a noisy mobile mart receipt', () => {
      const result = parseImportText(MART_RECEIPT_SAMPLE_A);

      expect(result.template.id).toBe('receipt-ocr');
      expect(result.candidates.map((candidate) => candidate.name)).toEqual([
        '돌얼음2.5kg',
        '풀무원 국산두컵두부',
        '미국산냉장초이스갈비',
        '아인슈타인베이글2봉',
        '필라델피아 크림치즈'
      ]);
      expect(result.candidates.map((candidate) => candidate.simplifiedName)).toEqual([
        '얼음',
        '두부',
        '소갈비',
        '베이글',
        '크림치즈'
      ]);
      expect(result.candidates[0]).toMatchObject({
        weightOrVolume: '2.5kg',
        storageType: '냉동',
        source: 'receipt_ocr'
      });
      expect(result.ignoredLines).toEqual(
        expect.arrayContaining(['8801114106921', '합계 65,380', '결제대상금액 65,380'])
      );
    });

    it('ignores discount lines and preserves count and weight from receipt product names', () => {
      const result = parseImportText(MART_RECEIPT_SAMPLE_B);

      expect(result.template.id).toBe('receipt-ocr');
      expect(result.candidates.map((candidate) => candidate.name)).toEqual([
        '오뚜기 옛날 참기름',
        '프라임 버터 450g*2입',
        '미국산냉장초이스갈비'
      ]);
      expect(result.candidates[1]).toMatchObject({
        simplifiedName: '버터',
        quantity: '2입 / 450g',
        unit: '입',
        weightOrVolume: '450g',
        category: '유제품',
        storageType: '냉장',
        selected: true
      });
      expect(result.candidates.map((candidate) => candidate.originalText)).not.toContain('신세계포인트적립할인 -3,800');
    });
  });
});
