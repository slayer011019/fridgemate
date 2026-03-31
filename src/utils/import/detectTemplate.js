const ORDER_HEADER_PATTERN = /\d{4}\.\s?\d{1,2}\.\s?\d{1,2}\s*주문/;
const DELIVERY_HEADER_PATTERN = /(?:배송완료|배송중|배송예정|상품준비중)\s*[·.]?\s*\d{1,2}\/\d{1,2}(?:\([^)]*\))?\s*도착/;
const PRICE_LINE_PATTERN = /\d{1,3}(?:,\d{3})*원(?:\s*[·.]?\s*(?:\d+개입|\d+개|\d+팩|\d+구|\d+(?:\.\d+)?(?:kg|g|ml|l)))?/i;
const ACTION_LINE_PATTERN = /(장바구니\s*담기|바로구매|구매하기|옵션\s*선택|상품정보)/;
const BRAND_TAG_PATTERN = /(로켓프레시|판매자로켓|로켓\s*내일|로켓직구|로켓배송)/;

function toCandidateTexts({ rawText = '', lineItems = [] }) {
  if (Array.isArray(lineItems) && lineItems.length) {
    return lineItems.map((item) => String(item.text || '').trim()).filter(Boolean);
  }

  return String(rawText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function detectImportTemplate(source = {}) {
  const texts = toCandidateTexts(source);
  const signals = {
    orderHeaders: texts.filter((line) => ORDER_HEADER_PATTERN.test(line)).length,
    deliveryHeaders: texts.filter((line) => DELIVERY_HEADER_PATTERN.test(line)).length,
    priceLines: texts.filter((line) => PRICE_LINE_PATTERN.test(line)).length,
    actionLines: texts.filter((line) => ACTION_LINE_PATTERN.test(line)).length,
    brandTags: texts.filter((line) => BRAND_TAG_PATTERN.test(line)).length
  };

  const score =
    signals.orderHeaders * 3 +
    signals.deliveryHeaders * 3 +
    signals.priceLines * 2 +
    signals.actionLines * 2 +
    signals.brandTags;

  if (score >= 6) {
    return {
      id: 'coupang-order-history',
      confidence: score >= 10 ? 'high' : 'medium',
      signals
    };
  }

  return {
    id: 'generic-text',
    confidence: 'low',
    signals
  };
}
