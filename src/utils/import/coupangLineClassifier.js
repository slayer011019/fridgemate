const ORDER_HEADER_PATTERN = /^\d{4}\.\s?\d{1,2}\.\s?\d{1,2}\s?주문$/;
const DELIVERY_HEADER_PATTERN =
  /^(?:배송완료|배송중|배송예정|상품준비중)\s*[\u00B7.]?\s*\d{1,2}\/\d{1,2}(?:\([^)]*\))?\s*도착$/;
const PRICE_LINE_PATTERN =
  /^\d{1,3}(?:,\d{3})*원(?:\s*[\u00B7.]?\s*(?:\d+개입|\d+개|\d+팩|\d+봉|\d+박스|\d+구|\d+(?:\.\d+)?(?:kg|g|ml|l)))?$/i;
const ACTION_LINE_PATTERN =
  /^(?:장바구니\s*담기|바로구매|구매하기|옵션\s*선택|상품정보|담기)$/;

const BRAND_TAGS = ['로켓프레시', '판매자로켓', '로켓 내일', '로켓직구', '로켓배송'];

const NOISE_KEYWORDS = [
  '결제',
  '합계',
  '총액',
  '할인',
  '적립',
  '카드',
  '주소',
  '연락처',
  '배송지',
  '배송비',
  '문자',
  '상세',
  '정보',
  '배송메모',
  '보험',
  '포인트',
  '후기',
  '리뷰',
  '주문번호'
];

const FORCE_BREAK_PATTERNS = [
  /(\d{4}\.\s?\d{1,2}\.\s?\d{1,2}\s?주문)/g,
  /((?:배송완료|배송중|배송예정|상품준비중)\s*[\u00B7.]?\s*\d{1,2}\/\d{1,2}(?:\([^)]*\))?\s*도착)/g,
  /(로켓프레시|판매자로켓|로켓 내일|로켓직구|로켓배송)/g,
  /(\d{1,3}(?:,\d{3})*원(?:\s*[\u00B7.]?\s*(?:\d+개입|\d+개|\d+팩|\d+봉|\d+박스|\d+구|\d+(?:\.\d+)?(?:kg|g|ml|l)))?)/gi,
  /(장바구니\s*담기|바로구매|구매하기|옵션\s*선택|상품정보)/g
];

function cleanLine(line) {
  return String(line || '')
    .replace(/\s+/g, ' ')
    .replace(/[|[\]{}<>]+/g, ' ')
    .trim();
}

export function normalizeCoupangRawText(rawText) {
  let text = String(rawText || '').replace(/\r\n/g, '\n');

  FORCE_BREAK_PATTERNS.forEach((pattern) => {
    text = text.replace(pattern, '\n$1\n');
  });

  return text
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
}

function isBrandOnly(line) {
  return BRAND_TAGS.includes(line);
}

function looksLikeNoise(line) {
  if (!line) {
    return true;
  }

  if (/^[^0-9A-Za-z가-힣]+$/.test(line) || /^\d+$/.test(line)) {
    return true;
  }

  if (/^\d{2,4}-\d{3,4}-\d{4}$/.test(line)) {
    return true;
  }

  if (NOISE_KEYWORDS.some((keyword) => line.includes(keyword))) {
    return true;
  }

  return false;
}

function looksLikePriceLine(line) {
  return PRICE_LINE_PATTERN.test(line) || /^\d{1,3}(?:,\d{3})*원\s*[\u00B7.]/.test(line);
}

export function classifyCoupangLine(rawLine) {
  const line = cleanLine(rawLine);

  if (!line) {
    return { type: 'noise', line };
  }

  if (ORDER_HEADER_PATTERN.test(line)) {
    return { type: 'orderHeader', line };
  }

  if (DELIVERY_HEADER_PATTERN.test(line)) {
    return { type: 'deliveryHeader', line };
  }

  if (isBrandOnly(line)) {
    return { type: 'brandOnly', line };
  }

  if (ACTION_LINE_PATTERN.test(line)) {
    return { type: 'actionLine', line };
  }

  if (looksLikePriceLine(line)) {
    return { type: 'priceLine', line };
  }

  if (looksLikeNoise(line)) {
    return { type: 'noise', line };
  }

  if (line.length >= 2 && /[a-zA-Z가-힣]/.test(line)) {
    return { type: 'productTitle', line };
  }

  return { type: 'noise', line };
}

function splitLineItem(lineItem) {
  const normalized = normalizeCoupangRawText(lineItem.text);

  return normalized
    .split(/\r?\n/)
    .map((line) => cleanLine(line))
    .filter(Boolean)
    .map((line) => ({
      ...lineItem,
      text: line
    }));
}

function buildLineItemsFromRawText(rawText) {
  return normalizeCoupangRawText(rawText)
    .split(/\r?\n/)
    .map((line) => cleanLine(line))
    .filter(Boolean)
    .map((line) => ({ text: line, bbox: null, source: 'rawText' }));
}

export function classifyCoupangLines(source = {}) {
  const lineItems =
    Array.isArray(source.lineItems) && source.lineItems.length
      ? source.lineItems.flatMap(splitLineItem)
      : buildLineItemsFromRawText(source.rawText || '');

  return lineItems
    .map((lineItem, index) => {
      const line = cleanLine(lineItem.text);
      const classified = classifyCoupangLine(line);
      return {
        index,
        rawLine: line,
        bbox: lineItem.bbox || null,
        words: lineItem.words || [],
        source: lineItem.source || 'ocr',
        ...classified
      };
    })
    .filter((entry) => entry.line);
}
