import { describe, expect, it } from 'vitest';
import { isGarbageLine, isGarbageSuspect, scoreConfidence } from '../receiptGarbageFilter.js';

describe('receiptGarbageFilter', () => {
  describe('isGarbageLine', () => {
    it('주소 줄을 쓰레기로 분류한다', () => {
      expect(isGarbageLine('이권영 충북 청주시 서원구 산남동')).toBe(true);
      expect(isGarbageLine('배송지 서울시 어쩌구')).toBe(true);
    });

    it('합계/승인번호 줄을 쓰레기로 분류한다', () => {
      expect(isGarbageLine('합계 23,400원')).toBe(true);
      expect(isGarbageLine('승인번호 12345678')).toBe(true);
    });

    it('실제 재료 줄은 쓰레기로 분류하지 않는다', () => {
      expect(isGarbageLine('고추 100g')).toBe(false);
      expect(isGarbageLine('양파 2개')).toBe(false);
      expect(isGarbageLine('삼겹살 500g')).toBe(false);
      expect(isGarbageLine('대파 1단')).toBe(false);
      expect(isGarbageLine('계란 10구')).toBe(false);
    });
  });

  describe('isGarbageSuspect', () => {
    it('확실한 쓰레기는 아니지만 의심스러운 줄을 분류한다', () => {
      expect(isGarbageSuspect('23,400원')).toBe(true);
      expect(isGarbageSuspect('동네마트')).toBe(true);
      expect(isGarbageSuspect('행사')).toBe(true);
    });
  });

  describe('scoreConfidence', () => {
    it('재료 사전 매칭 + 수량 있으면 높은 점수를 준다', () => {
      const score = scoreConfidence({
        name: '고추',
        hasQuantity: true,
        matchedCanonical: true,
        isGarbage: false,
        isSuspect: false
      });

      expect(score).toBeGreaterThanOrEqual(0.8);
    });

    it('쓰레기 줄은 낮은 점수를 준다', () => {
      const score = scoreConfidence({
        name: '23400',
        hasQuantity: false,
        matchedCanonical: false,
        isGarbage: true,
        isSuspect: false
      });

      expect(score).toBeLessThan(0.3);
    });

    it('수량 없으면 needsReview 조건을 만족하는 점수를 준다', () => {
      const score = scoreConfidence({
        name: '두부',
        hasQuantity: false,
        matchedCanonical: true,
        isGarbage: false,
        isSuspect: false
      });

      expect(score).toBeLessThan(0.8);
    });
  });
});
