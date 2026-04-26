import { guessCategory, guessStorageType } from './importGuesser.js';

const PRICE_PATTERN = /\d{1,3}(?:,\d{3})+/;
const PRICE_TAIL_PATTERN = /\s+\d{1,3}(?:,\d{3})+(?:원)?(?:\s+\d+(?:\.\d+)?)?(?:\s+\d{1,3}(?:,\d{3})+(?:원)?)?\s*$/;
const BARCODE_PATTERN = /^\d{10,}$/;
const HANGUL_PATTERN = /[가-힣]/;
const SECTION_START_PATTERN = /(상품\s*명|상\s*품\s*명|단가\s*수량\s*금액|\[?\s*구매\s*\]?)/;
const SECTION_END_PATTERN = /(총\s*품목\s*수량|합계|결제대상금액|카드결제|부가세)/;
const LINE_SEPARATOR_PATTERN = /^[-=~_\s]{3,}$/;
const DATE_TIME_ONLY_PATTERN =
  /^(\[?\s*구매\s*\]?\s*)?\d{4}[-./년\s]\d{1,2}[-./월\s]\d{1,2}(?:일)?(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?(?:\s+POS[:\s-]*[\d-]+)?$/i;
const PHONE_PATTERN = /(?:\(?0\d{1,2}\)?[-)\s]?\d{3,4}[-\s]?\d{4}|01[016789][-\s]?\d{3,4}[-\s]?\d{4})/;
const BUSINESS_NUMBER_PATTERN = /\d{3}[-\s]?\d{2}[-\s]?\d{5}/;
const CARD_NUMBER_PATTERN = /(카드|card).*(\d{4}[-\s*]){2,}\d{2,4}|(\d{4}[-\s*]){3}\d{2,4}/i;
const POS_PATTERN = /\bPOS\b|포스|pos[:\s-]*\d+/i;
const ADDRESS_PATTERN =
  /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주|특별시|광역시|특별자치시|도)\s?.*(시|군|구|읍|면|동|로|길|대로)/;

const NOISE_KEYWORDS = [
  '합계',
  '부가세',
  '과세',
  '면세',
  '결제',
  '카드',
  '승인',
  'POS',
  '포인트',
  '적립',
  '할인',
  '환불',
  '교환',
  '영수증',
  '사업자',
  '전화',
  '주소',
  '총품목',
  '총 품목',
  '결제대상금액',
  '받은금액',
  '거스름돈'
];

const HEADER_KEYWORDS = ['상품명', '상 품 명', '단가 수량 금액', '구매'];
const PRODUCT_DICTIONARY = [
  { keywords: ['돌얼음', '얼음'], simplifiedName: '얼음', category: '냉동식품', storageType: '냉동' },
  { keywords: ['국산두컵두부', '풀무원 두부', '두부'], simplifiedName: '두부', category: '기타', storageType: '냉장' },
  {
    keywords: ['미국산냉장초이스갈비', '냉장초이스갈비', '초이스갈비'],
    simplifiedName: '소갈비',
    category: '육류',
    storageType: '냉장'
  },
  { keywords: ['베이글'], simplifiedName: '베이글', category: '간편식', storageType: '실온', needsReview: true },
  { keywords: ['필라델피아 크림치즈', '크림치즈'], simplifiedName: '크림치즈', category: '유제품', storageType: '냉장' },
  { keywords: ['프라임 버터', '버터'], simplifiedName: '버터', category: '유제품', storageType: '냉장' },
  { keywords: ['참기름'], simplifiedName: '참기름', category: '소스', storageType: '실온' },
  { keywords: ['와일드터키', '레어브리'], simplifiedName: '주류', category: '기타', storageType: '실온', needsReview: true },
  { keywords: ['바이스비어'], simplifiedName: '주류', category: '기타', storageType: '냉장', needsReview: true }
];

function clampScore(value) {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function normalizeComparable(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, '');
}

function hasNoiseKeyword(line) {
  const normalized = String(line || '').toLowerCase();
  return NOISE_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function isSectionMarker(line) {
  return HEADER_KEYWORDS.some((keyword) => String(line || '').replace(/\s+/g, ' ').includes(keyword));
}

function isDiscountLine(line) {
  return /(할인|포인트|적립|쿠폰|에누리|프로모션)/.test(line) || /-\s*\d{1,3}(?:,\d{3})+/.test(line);
}

function isReceiptNoiseLine(line, { keepSectionMarkers = false } = {}) {
  const text = String(line || '').trim();

  if (!text) return true;
  if (keepSectionMarkers && (isSectionMarker(text) || SECTION_END_PATTERN.test(text))) return false;
  if (LINE_SEPARATOR_PATTERN.test(text)) return true;
  if (/^\d+$/.test(text)) return true;
  if (BARCODE_PATTERN.test(text)) return true;
  if (PHONE_PATTERN.test(text)) return true;
  if (BUSINESS_NUMBER_PATTERN.test(text)) return true;
  if (CARD_NUMBER_PATTERN.test(text)) return true;
  if (POS_PATTERN.test(text) && !PRICE_PATTERN.test(text)) return true;
  if (ADDRESS_PATTERN.test(text)) return true;
  if (DATE_TIME_ONLY_PATTERN.test(text)) return true;

  if (isDiscountLine(text)) return true;

  if (hasNoiseKeyword(text)) {
    const looksLikeProductWithPrice = PRICE_PATTERN.test(text) && HANGUL_PATTERN.test(text) && !isSectionMarker(text);
    return !looksLikeProductWithPrice;
  }

  return false;
}

function stripReceiptProductName(line) {
  return String(line || '')
    .replace(/^[*\-•·\s]+/g, '')
    .replace(/\b\d{10,}\b/g, ' ')
    .replace(PRICE_TAIL_PATTERN, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractWeightOrVolume(name) {
  return (
    String(name || '').match(/\d+(?:\.\d+)?\s*(?:kg|㎏|킬로그램|킬로|키로|g|그램|ml|㎖|mL|l|L|ℓ|리터)/i)?.[0]
      ?.replace(/\s+/g, '')
      .replace(/㎏|킬로그램|킬로|키로/gi, 'kg')
      .replace(/그램/gi, 'g')
      .replace(/㎖/g, 'ml')
      .replace(/ℓ|리터/gi, 'L') || ''
  );
}

function extractCountUnit(name) {
  const compactName = String(name || '').replace(/\s+/g, '');
  const packMatch = compactName.match(/(?:\*(\d+)(입|개|봉|팩|박스|병|캔))|(\d+)(입|개입|개|봉|팩|박스|구|병|캔)$/);

  if (!packMatch) {
    return { quantity: '', unit: '' };
  }

  return {
    quantity: Number(packMatch[1] || packMatch[3]),
    unit: packMatch[2] || packMatch[4] || ''
  };
}

function matchIngredientDictionary(name) {
  const normalized = normalizeComparable(name);
  const rule = PRODUCT_DICTIONARY.find((entry) => entry.keywords.some((keyword) => normalized.includes(normalizeComparable(keyword))));

  if (!rule) {
    const category = guessCategory(name);
    return {
      simplifiedName: stripReceiptProductName(name),
      category,
      storageType: guessStorageType(name, category),
      matched: false,
      needsReview: false
    };
  }

  return {
    simplifiedName: rule.simplifiedName,
    category: rule.category,
    storageType: rule.storageType,
    matched: true,
    needsReview: Boolean(rule.needsReview)
  };
}

function calculateReceiptConfidence({ originalText, name, dictionaryMatch, quantity, unit, weightOrVolume, storageType, fromPriceSection }) {
  let score = 0;

  if (fromPriceSection) score += 0.25;
  if (HANGUL_PATTERN.test(name)) score += 0.2;
  if (dictionaryMatch) score += 0.3;
  if (quantity || unit || weightOrVolume) score += 0.15;
  if (storageType) score += 0.1;
  if (isDiscountLine(originalText) || /(결제|카드|승인|포인트|적립|할인)/.test(originalText)) score -= 0.5;
  if ((originalText.match(/\d/g) || []).length > 10 && !/[가-힣]{2,}/.test(originalText)) score -= 0.4;
  if (isReceiptNoiseLine(originalText)) score -= 0.5;
  if (name.length > 30) score -= 0.2;

  return clampScore(score);
}

function buildReceiptCandidate(item, index, today) {
  const dictionaryMatch = matchIngredientDictionary(item.name);
  const countUnit = extractCountUnit(item.name);
  const weightOrVolume = extractWeightOrVolume(item.name);
  const quantity = countUnit.quantity || 1;
  const unit = countUnit.unit || '개';
  const confidence = calculateReceiptConfidence({
    originalText: item.originalText,
    name: item.name,
    dictionaryMatch: dictionaryMatch.matched,
    quantity,
    unit,
    weightOrVolume,
    storageType: dictionaryMatch.storageType,
    fromPriceSection: item.fromPriceSection
  });
  const needsReview = dictionaryMatch.needsReview || confidence < 0.7 || item.name.length > 30;
  const quantityText = weightOrVolume
    ? `${quantity}${unit} / ${weightOrVolume}`
    : `${quantity}${unit}`;

  return {
    id: `receipt-candidate-${index}-${crypto.randomUUID()}`,
    originalText: item.originalText,
    name: item.name,
    originalName: item.name,
    displayName: item.name,
    normalizedName: dictionaryMatch.simplifiedName || item.name,
    simplifiedName: dictionaryMatch.simplifiedName || item.name,
    quantity: quantityText,
    originalQuantity: quantityText,
    unit,
    weightOrVolume,
    specText: quantityText,
    category: dictionaryMatch.category,
    storageType: dictionaryMatch.storageType,
    selected: confidence >= 0.7,
    confidence,
    needsReview,
    purchaseDate: today,
    expiryDate: '',
    memo: '',
    consumed: false,
    source: 'receipt_ocr',
    rawLine: item.originalText,
    sourceLine: item.originalText
  };
}

export function normalizeReceiptText(rawText = '') {
  return String(rawText || '')
    .normalize('NFKC')
    .replace(/[\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000]/g, ' ')
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/[-=~_]{3,}/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .trim()
    )
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function splitReceiptLines(normalizedText = '') {
  return String(normalizedText || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);
}

export function removeReceiptNoiseLines(lines = [], options = {}) {
  return lines.filter((line) => !isReceiptNoiseLine(line, options));
}

export function detectItemSection(lines = []) {
  if (!lines.length) {
    return { lines: [], startIndex: -1, endIndex: -1, detected: false };
  }

  const headerIndex = lines.findIndex((line) => SECTION_START_PATTERN.test(line));
  let startIndex = headerIndex >= 0 ? headerIndex + 1 : -1;

  if (startIndex < 0) {
    const firstPriceIndex = lines.findIndex((line, index) => {
      const window = lines.slice(index, index + 5);
      return window.filter((entry) => PRICE_PATTERN.test(entry)).length >= 2;
    });
    startIndex = firstPriceIndex;
  }

  if (startIndex < 0) {
    return { lines, startIndex: 0, endIndex: lines.length, detected: false };
  }

  const relativeEndIndex = lines.slice(startIndex).findIndex((line) => SECTION_END_PATTERN.test(line));
  const endIndex = relativeEndIndex >= 0 ? startIndex + relativeEndIndex : lines.length;

  return {
    lines: lines.slice(startIndex, endIndex),
    startIndex,
    endIndex,
    detected: true
  };
}

export function extractReceiptItems(lines = []) {
  const items = [];

  lines.forEach((line, index) => {
    if (isReceiptNoiseLine(line) || isSectionMarker(line) || isDiscountLine(line)) {
      return;
    }

    if (!PRICE_PATTERN.test(line) || !HANGUL_PATTERN.test(line)) {
      return;
    }

    const name = stripReceiptProductName(line);

    if (!name || name.length < 2 || !HANGUL_PATTERN.test(name) || BARCODE_PATTERN.test(name)) {
      return;
    }

    items.push({
      originalText: line,
      name,
      lineIndex: index,
      fromPriceSection: true
    });
  });

  return items;
}

export function createIngredientCandidates(items = [], today) {
  const seen = new Set();

  return items.reduce((candidates, item, index) => {
    const key = normalizeComparable(item.name);

    if (!key || seen.has(key)) {
      return candidates;
    }

    seen.add(key);
    candidates.push(buildReceiptCandidate(item, index, today));
    return candidates;
  }, []);
}

export function isLikelyReceiptText(lines = []) {
  const joinedText = lines.join('\n');
  const barcodeCount = lines.filter((line) => BARCODE_PATTERN.test(line)).length;
  const priceRowCount = lines.filter((line) => PRICE_PATTERN.test(line) && HANGUL_PATTERN.test(line)).length;
  const looksLikeCommerceOrder = /(쿠팡|로켓|장바구니|배송완료|배송중|주문)/.test(joinedText);
  const hasReceiptAnchor = /(상품\s*명|상\s*품\s*명|총\s*품목\s*수량|합계|결제대상금액)/.test(joinedText);

  if (looksLikeCommerceOrder && !hasReceiptAnchor && barcodeCount < 2) {
    return false;
  }

  return (
    hasReceiptAnchor ||
    SECTION_START_PATTERN.test(joinedText) ||
    SECTION_END_PATTERN.test(joinedText) ||
    barcodeCount >= 2 ||
    priceRowCount >= 3
  );
}

export function parseReceiptText(rawText = '', today) {
  const normalizedText = normalizeReceiptText(rawText);
  const lines = splitReceiptLines(normalizedText);
  const likelyReceipt = isLikelyReceiptText(lines);
  const prefilteredLines = removeReceiptNoiseLines(lines, { keepSectionMarkers: true });
  const section = detectItemSection(prefilteredLines);
  const itemSectionLines = removeReceiptNoiseLines(section.lines);
  const items = extractReceiptItems(itemSectionLines);
  const candidates = likelyReceipt ? createIngredientCandidates(items, today) : [];

  return {
    normalizedText,
    lines,
    usefulLines: items.map((item) => item.originalText),
    ignoredLines: lines.filter((line) => !items.some((item) => item.originalText === line)),
    candidates,
    receiptItems: items,
    itemSection: section,
    template: {
      id: candidates.length ? 'receipt-ocr' : 'generic-text',
      confidence: candidates.length >= 2 ? 'high' : 'medium'
    }
  };
}
