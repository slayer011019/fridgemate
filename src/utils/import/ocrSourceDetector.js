export const OCR_SOURCE_TYPES = {
  COUPANG_ORDER: 'coupang_order',
  KURLY_ORDER: 'kurly_order',
  RECEIPT: 'receipt',
  GENERIC_SHOPPING_ORDER: 'generic_shopping_order',
  UNKNOWN: 'unknown'
};

const MIN_CONFIDENT_SCORE = 4;
const AMBIGUOUS_MARGIN = 1;

const SOURCE_RULES = {
  [OCR_SOURCE_TYPES.COUPANG_ORDER]: {
    keywords: ['쿠팡', '로켓배송', '로켓프레시', '로켓와우', '주문목록', '배송조회', '재구매', '쿠페이', '판매자'],
    patterns: [/장바구니\s*담기/, /\d{4}\.\s?\d{1,2}\.\s?\d{1,2}\s*주문/, /배송(?:완료|중|예정).*도착/]
  },
  [OCR_SOURCE_TYPES.KURLY_ORDER]: {
    keywords: ['컬리', 'Kurly', '샛별배송', '주문 내역 상세', '전체 상품 다시 담기', '컬리캐시', 'KF365', "Kurly's", '컬리멤버스'],
    patterns: [/샛별\s*배송/i, /전체\s*상품\s*다시\s*담기/, /주문\s*내역\s*상세/]
  },
  [OCR_SOURCE_TYPES.RECEIPT]: {
    keywords: [
      'POS',
      '상품명 단가 수량 금액',
      '상 품 명',
      '단 가',
      '수 량',
      '금 액',
      '결제대상금액',
      '부가세',
      '면세',
      '과세',
      '사업자번호',
      '승인번호'
    ],
    patterns: [/상품\s*명.*단가.*수량.*금액/, /상\s*품\s*명/, /\bPOS\b/i, /총\s*품목\s*수량/, /\d{10,}/]
  }
};

export function normalizeOcrSourceText(rawText = '') {
  return String(rawText || '')
    .normalize('NFKC')
    .replace(/[\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000]/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function scoreRule(normalizedText, rule) {
  const lowerText = normalizedText.toLowerCase();
  const keywordScore = rule.keywords.reduce((score, keyword) => {
    return lowerText.includes(keyword.toLowerCase()) ? score + 2 : score;
  }, 0);
  const patternScore = rule.patterns.reduce((score, pattern) => {
    return pattern.test(normalizedText) ? score + 3 : score;
  }, 0);

  return keywordScore + patternScore;
}

export function detectOcrSourceType(rawText = '') {
  const normalizedText = normalizeOcrSourceText(rawText);
  const scores = Object.entries(SOURCE_RULES).reduce((result, [sourceType, rule]) => {
    result[sourceType] = scoreRule(normalizedText, rule);
    return result;
  }, {});
  const ranked = Object.entries(scores).sort((left, right) => right[1] - left[1]);
  const [bestType, bestScore] = ranked[0] || [OCR_SOURCE_TYPES.UNKNOWN, 0];
  const secondScore = ranked[1]?.[1] || 0;
  let sourceType = bestType;

  if (bestScore < MIN_CONFIDENT_SCORE) {
    sourceType = OCR_SOURCE_TYPES.UNKNOWN;
  } else if (bestScore - secondScore <= AMBIGUOUS_MARGIN) {
    sourceType = OCR_SOURCE_TYPES.GENERIC_SHOPPING_ORDER;
  }

  return {
    sourceType,
    confidence: bestScore <= 0 ? 0 : Math.max(0, Math.min(1, Math.round((bestScore / Math.max(bestScore + secondScore, 1)) * 100) / 100)),
    scores,
    normalizedText
  };
}

