import { guessCategory, guessStorageType } from './importGuesser.js';
import { cleanImportedProductTitle, normalizeImportedIngredient } from './ingredientNormalizer.js';

const STORAGE_ROOM = '상온';
const STORAGE_FRIDGE = '냉장';
const STORAGE_FREEZER = '냉동';

const CATEGORY_NOODLES = '라면/면류';
const CATEGORY_DAIRY = '유제품';
const CATEGORY_BEANS = '두부/콩류';
const CATEGORY_FROZEN = '냉동식품';
const CATEGORY_MEAT = '육류';
const CATEGORY_PROCESSED_MEAT = '육류/가공육';
const CATEGORY_VEGETABLE = '채소';
const CATEGORY_FRUIT = '과일';
const CATEGORY_SNACK = '간식';
const CATEGORY_SAUCE = '양념/소스';
const CATEGORY_OTHER = '기타';

const OCR_ALIAS_RULES = [
  {
    pattern: /^C(?=\s*[가-힣A-Za-z])/i,
    replacement: 'CJ'
  }
];

const PROMO_NOISE_PATTERN = /(?:^|\s)(?:기획|행사|증정|사은품|세트|묶음|특가|추천|쿠폰|할인)(?=\s|$)/gi;
const RECEIPT_CATEGORY_HINTS = [
  {
    keywords: ['양념', '소스', '드레싱', '쌈장', '된장', '고추장', '간장', '마요', '케첩', '육수'],
    category: CATEGORY_SAUCE,
    storageType: STORAGE_ROOM,
    includeByDefault: false
  },
  {
    keywords: ['만두', '교자'],
    category: CATEGORY_FROZEN,
    storageType: STORAGE_FREEZER,
    includeByDefault: true
  },
  {
    keywords: ['라면', '우동', '국수', '냉면', '소면', '스파게티', '파스타', '면'],
    category: CATEGORY_NOODLES,
    storageType: STORAGE_ROOM,
    includeByDefault: false
  },
  {
    keywords: ['과자', '스낵', '쿠키', '비스킷', '칩', '강정', '땅콩', '초콜릿', '캔디'],
    category: CATEGORY_SNACK,
    storageType: STORAGE_ROOM,
    includeByDefault: false
  },
  {
    keywords: ['우유', '치즈', '요거트', '버터', '생크림'],
    category: CATEGORY_DAIRY,
    storageType: STORAGE_FRIDGE,
    includeByDefault: true
  },
  {
    keywords: ['두부', '순두부', '연두부', '콩'],
    category: CATEGORY_BEANS,
    storageType: STORAGE_FRIDGE,
    includeByDefault: true
  },
  {
    keywords: ['훈제', '햄', '베이컨', '소시지'],
    category: CATEGORY_PROCESSED_MEAT,
    storageType: STORAGE_FRIDGE,
    includeByDefault: true
  },
  {
    keywords: ['삼겹살', '목살', '돼지', '소고기', '쇠고기', '한우', '오리', '닭', '설도', '갈비'],
    category: CATEGORY_MEAT,
    storageType: STORAGE_FRIDGE,
    includeByDefault: true
  },
  {
    keywords: ['상추', '깻잎', '쌈', '채소', '숙주', '콩나물', '양파', '대파', '오이', '감자', '당근', '토마토', '호박', '버섯'],
    category: CATEGORY_VEGETABLE,
    storageType: STORAGE_FRIDGE,
    includeByDefault: true
  },
  {
    keywords: ['사과', '바나나', '참외', '포도', '귤', '오렌지', '키위', '딸기', '수박', '과일'],
    category: CATEGORY_FRUIT,
    storageType: STORAGE_FRIDGE,
    includeByDefault: true
  }
];

const IGNORE_KEYWORDS = [
  '재사용 봉투',
  '봉투',
  '면세 물품가액',
  '과세 물품가액',
  '부가세',
  '합계',
  '자사할인',
  '결제금액',
  '결제대상금액',
  '카드번호',
  '현금IC',
  'POS',
  '승인번호',
  '할인 상세내역',
  '사업자번호',
  '상품명 단가 수량 금액',
  '총 품목 수량'
];

const DISCOUNT_KEYWORDS = ['할인', '번들', '쿠폰'];
const RECEIPT_HEADER_PATTERNS = [/상품\s*명.*단가.*수량.*금액/i, /총\s*품목\s*수량/i];
const NUMBER_TOKEN_PATTERN = /^-?\d{1,3}(?:,\d{3})*$|^-?\d+$/;
const PERCENT_TOKEN_PATTERN = /^\d+%$/;
const HAS_NAME_PATTERN = /[A-Za-z가-힣]/;
const TRAILING_GRADE_PATTERN = /\(\s*\d+\s*등급\s*\)/g;
const RECEIPT_DATE_PATTERN = /^\[?\s*구매\s*\]?\s*\d{4}[-./]\d{1,2}[-./]\d{1,2}/i;
const PHONE_PATTERN = /(?:\(?0\d{1,2}\)?[-)\s]?\d{3,4}[-\s]?\d{4}|01[016789][-\s]?\d{3,4}[-\s]?\d{4})/;
const ADDRESS_PATTERN = /(특별시|광역시|도|시).{0,20}(구|군|읍|면|동|로|길)/;

function clampConfidence(value) {
  return Math.max(0.1, Math.min(0.99, Math.round(value * 100) / 100));
}

function formatAmount(amount) {
  return new Intl.NumberFormat('ko-KR').format(amount);
}

function isNumericToken(token) {
  return NUMBER_TOKEN_PATTERN.test(token);
}

function parseNumberValue(token) {
  if (!token) {
    return null;
  }

  const normalized = String(token).replace(/,/g, '').trim();

  if (!/^-?\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isQuantityValue(value, rawToken = '') {
  return Number.isInteger(value) && value >= 1 && value <= 99 && !String(rawToken).includes(',');
}

function isPriceValue(value, rawToken = '') {
  return value >= 100 || String(rawToken).includes(',');
}

function normalizeSpacing(text) {
  return String(text || '')
    .normalize('NFKC')
    .replace(/[\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000]/g, ' ')
    .replace(/(^|\s)-\s+(?=\d)/g, '$1-')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function normalizeComparable(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, '');
}

function applyOcrAliases(text) {
  return OCR_ALIAS_RULES.reduce((current, rule) => current.replace(rule.pattern, rule.replacement), String(text || ''));
}

function mapReceiptStorageType(storageType) {
  if (!storageType) {
    return STORAGE_FRIDGE;
  }

  if (storageType === '팬트리' || storageType === '실온' || storageType === STORAGE_ROOM) {
    return STORAGE_ROOM;
  }

  return storageType;
}

function findCategoryHint(text) {
  const comparable = normalizeComparable(text);

  return RECEIPT_CATEGORY_HINTS.find((rule) =>
    rule.keywords.some((keyword) => comparable.includes(normalizeComparable(keyword)))
  );
}

/**
 * @typedef {Object} ReceiptParsedItem
 * @property {string} rawName
 * @property {string} normalizedName
 * @property {number|null} unitPrice
 * @property {number} quantity
 * @property {number|null} totalPrice
 * @property {number} discount
 * @property {string} category
 * @property {string} storageType
 * @property {boolean} includeByDefault
 * @property {number} confidence
 * @property {string} reason
 * @property {number[]} lineIndexes
 * @property {string[]} sourceLines
 */

/**
 * @typedef {Object} ReceiptParseResult
 * @property {'receipt'} sourceType
 * @property {string} normalizedText
 * @property {string[]} lines
 * @property {string[]} usefulLines
 * @property {string[]} ignoredLines
 * @property {string[]} warnings
 * @property {ReceiptParsedItem[]} items
 * @property {ReceiptParsedItem[]} receiptItems
 * @property {Array<Object>} candidates
 * @property {{id: string, confidence: string}} template
 * @property {{lines: string[], startIndex: number, endIndex: number, detected: boolean}} itemSection
 */

function createLineInfo(text, index) {
  const tokens = text.split(' ').filter(Boolean);
  const compactText = text.replace(/\s+/g, '');
  const numericTokens = tokens
    .map((token, tokenIndex) => {
      if (!isNumericToken(token)) {
        return null;
      }

      const value = parseNumberValue(token);

      if (value === null) {
        return null;
      }

      return {
        token,
        value,
        tokenIndex,
        hasComma: token.includes(','),
        negative: value < 0
      };
    })
    .filter(Boolean);
  const standaloneNumber = tokens.length === 1 && isNumericToken(tokens[0]) ? parseNumberValue(tokens[0]) : null;
  const hasDiscountKeyword = DISCOUNT_KEYWORDS.some((keyword) => text.includes(keyword));
  const matchesIgnoreKeyword = IGNORE_KEYWORDS.some((keyword) => text.includes(keyword));
  const isPercentOnly = tokens.length === 1 && PERCENT_TOKEN_PATTERN.test(tokens[0]);
  const hasNameText = HAS_NAME_PATTERN.test(text);
  const isHeader = RECEIPT_HEADER_PATTERNS.some((pattern) => pattern.test(text));
  const isMeta =
    RECEIPT_DATE_PATTERN.test(text) ||
    PHONE_PATTERN.test(text) ||
    ADDRESS_PATTERN.test(text) ||
    /^\d{10,}$/.test(compactText);

  return {
    index,
    text,
    compactText,
    tokens,
    numericTokens,
    standaloneNumber,
    hasDiscountKeyword,
    matchesIgnoreKeyword,
    isPercentOnly,
    hasNameText,
    isHeader,
    isMeta,
    isIgnored:
      matchesIgnoreKeyword ||
      isHeader ||
      isMeta ||
      /^[-=~_]{3,}$/.test(text) ||
      /^면세\s*물품가액/i.test(text) ||
      /^과세\s*물품가액/i.test(text),
    isDiscountMeta:
      hasDiscountKeyword ||
      /^\[[^\]]*(할인|번들|쿠폰)/i.test(text) ||
      (isPercentOnly && ['10%', '40%'].includes(tokens[0] || '')),
    isNegativeAmountOnly: standaloneNumber !== null && standaloneNumber < 0,
    isPositiveAmountOnly: standaloneNumber !== null && standaloneNumber > 0,
    nameText: tokens.filter((token) => !isNumericToken(token) && !PERCENT_TOKEN_PATTERN.test(token)).join(' ').trim()
  };
}

export function normalizeReceiptText(rawText = '') {
  return String(rawText || '')
    .normalize('NFKC')
    .replace(/[\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000]/g, ' ')
    .split(/\r?\n/)
    .map((line) => normalizeSpacing(line))
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function splitReceiptLines(normalizedText = '') {
  return String(normalizedText || '')
    .split(/\r?\n/)
    .map((line) => normalizeSpacing(line))
    .filter(Boolean);
}

function getDiscountAmount(lineInfo) {
  if (!lineInfo) {
    return null;
  }

  if (lineInfo.isPercentOnly || (lineInfo.text.includes('%') && !/원/.test(lineInfo.text))) {
    return null;
  }

  if (lineInfo.isNegativeAmountOnly) {
    return Math.abs(lineInfo.standaloneNumber);
  }

  const amountMatch = lineInfo.text.match(/-?\d{1,3}(?:,\d{3})+|-?\d+/);
  const amount = parseNumberValue(amountMatch?.[0] || '');

  if (amount === null) {
    return null;
  }

  if (lineInfo.hasDiscountKeyword || amount < 0) {
    return Math.abs(amount);
  }

  return null;
}

function cleanRawName(name) {
  return normalizeSpacing(String(name || ''))
    .replace(/^\*+\s*/, '')
    .replace(TRAILING_GRADE_PATTERN, ' ')
    .replace(PROMO_NOISE_PATTERN, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function normalizeProductName(name = '') {
  const aliased = applyOcrAliases(name);
  const cleaned = cleanRawName(aliased)
    .replace(/([A-Za-z])([가-힣])/g, '$1 $2')
    .replace(/([가-힣])([A-Za-z])/g, '$1 $2')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const lightlyNormalized = cleanImportedProductTitle(cleaned)
    .replace(/\s{2,}/g, ' ')
    .trim();

  return lightlyNormalized || cleaned;
}

export function classifyReceiptIngredient(name = '') {
  const normalizedIngredient = normalizeImportedIngredient(name);
  const hint = findCategoryHint(name) || findCategoryHint(normalizedIngredient.originalName) || findCategoryHint(normalizedIngredient.normalizedName);
  const fallbackCategory = normalizedIngredient.category || guessCategory(name) || CATEGORY_OTHER;
  const fallbackStorage = mapReceiptStorageType(
    normalizedIngredient.storageType || guessStorageType(name, fallbackCategory) || STORAGE_FRIDGE
  );
  const category = hint?.category || fallbackCategory;
  const shouldDefaultToRoom =
    !hint && !normalizedIngredient.matchedCanonical && (fallbackCategory === CATEGORY_OTHER || fallbackCategory === '기타');
  const storageType = hint?.storageType || (shouldDefaultToRoom ? STORAGE_ROOM : fallbackStorage);
  const includeByDefault =
    hint?.includeByDefault ??
    [CATEGORY_DAIRY, CATEGORY_BEANS, CATEGORY_MEAT, CATEGORY_PROCESSED_MEAT, CATEGORY_VEGETABLE, CATEGORY_FRUIT, '달걀'].includes(
      category
    );

  return {
    category,
    storageType,
    includeByDefault,
    matched: Boolean(hint || normalizedIngredient.matchedCanonical)
  };
}

function collectPreviousPositiveLine(lineInfos, startIndex, consumedIndexes) {
  for (let index = startIndex - 1; index >= 0 && index >= startIndex - 2; index -= 1) {
    if (consumedIndexes.has(index)) {
      continue;
    }

    const lineInfo = lineInfos[index];

    if (!lineInfo || lineInfo.isIgnored || lineInfo.isDiscountMeta || lineInfo.isNegativeAmountOnly) {
      continue;
    }

    if (lineInfo.isPositiveAmountOnly) {
      return lineInfo;
    }

    if (lineInfo.hasNameText) {
      break;
    }
  }

  return null;
}

function collectFollowingPositiveLines(lineInfos, startIndex, consumedIndexes) {
  const collected = [];

  for (let index = startIndex + 1; index < lineInfos.length && collected.length < 4; index += 1) {
    if (consumedIndexes.has(index)) {
      continue;
    }

    const lineInfo = lineInfos[index];

    if (!lineInfo) {
      continue;
    }

    if (lineInfo.isIgnored || lineInfo.isDiscountMeta || lineInfo.isNegativeAmountOnly) {
      continue;
    }

    if (lineInfo.hasNameText && !lineInfo.isPositiveAmountOnly) {
      break;
    }

    if (lineInfo.isPositiveAmountOnly) {
      collected.push(lineInfo);
      continue;
    }

    break;
  }

  return collected;
}

function buildSequence(values = []) {
  return values.map((lineInfo) => lineInfo?.standaloneNumber).filter((value) => Number.isFinite(value));
}

function createFallbackAssignment(sameLineNumbers, previousLine, nextPositiveLines) {
  const nextValues = buildSequence(nextPositiveLines);
  const firstSameLinePrice = sameLineNumbers.find((entry) => isPriceValue(entry.value, entry.token));
  const nextPrice = nextValues.find((value, index) => isPriceValue(value, nextPositiveLines[index]?.tokens[0] || ''));
  const nextQuantity = nextValues.find((value, index) => isQuantityValue(value, nextPositiveLines[index]?.tokens[0] || ''));
  const previousValue = previousLine?.standaloneNumber || null;
  const unitPrice = firstSameLinePrice?.value || nextPrice || previousValue || null;
  const quantity = nextQuantity || 1;
  const totalPriceCandidate = nextValues.find(
    (value) => value !== unitPrice && value !== quantity && isPriceValue(value, String(value))
  );
  const totalPrice = totalPriceCandidate || (unitPrice !== null ? unitPrice * quantity : null);

  return {
    unitPrice,
    quantity,
    totalPrice,
    consumedIndexes: [
      ...(previousLine && previousValue === unitPrice ? [previousLine.index] : []),
      ...nextPositiveLines
        .filter((lineInfo) => [quantity, totalPrice, unitPrice].includes(lineInfo.standaloneNumber))
        .map((lineInfo) => lineInfo.index)
    ],
    reason: totalPriceCandidate
      ? '상품명 주변 숫자 후보로 가격과 수량을 복원'
      : '총액이 없어 단가와 수량으로 금액을 계산',
    explicitQuantity: Boolean(nextQuantity),
    exactMatch: unitPrice !== null && totalPrice !== null && unitPrice * quantity === totalPrice,
    uncertain: true
  };
}

function resolveLineAssignment(lineInfos, lineInfo, consumedIndexes) {
  const sameLineNumbers = lineInfo.numericTokens.filter((entry) => entry.value > 0);
  const previousLine = collectPreviousPositiveLine(lineInfos, lineInfo.index, consumedIndexes);
  const nextPositiveLines = collectFollowingPositiveLines(lineInfos, lineInfo.index, consumedIndexes);
  const nextValues = buildSequence(nextPositiveLines);

  if (sameLineNumbers.length >= 3) {
    const lastThree = sameLineNumbers.slice(-3);
    const [unitPriceToken, quantityToken, totalPriceToken] = lastThree;

    if (isQuantityValue(quantityToken.value, quantityToken.token)) {
      return {
        unitPrice: unitPriceToken.value,
        quantity: quantityToken.value,
        totalPrice: totalPriceToken.value,
        consumedIndexes: [],
        reason: '상품명 + 단가 + 수량 + 금액 패턴 감지',
        explicitQuantity: true,
        exactMatch: unitPriceToken.value * quantityToken.value === totalPriceToken.value,
        uncertain: false
      };
    }
  }

  if (
    sameLineNumbers.length === 1 &&
    nextValues.length >= 2 &&
    isQuantityValue(nextValues[0], nextPositiveLines[0]?.tokens[0] || '') &&
    isPriceValue(nextValues[1], nextPositiveLines[1]?.tokens[0] || '')
  ) {
    return {
      unitPrice: sameLineNumbers[0].value,
      quantity: nextValues[0],
      totalPrice: nextValues[1],
      consumedIndexes: [nextPositiveLines[0].index, nextPositiveLines[1].index],
      reason: '상품명 + 단가 뒤에 수량과 금액이 이어진 패턴 감지',
      explicitQuantity: true,
      exactMatch: sameLineNumbers[0].value * nextValues[0] === nextValues[1],
      uncertain: false
    };
  }

  if (
    sameLineNumbers.length === 0 &&
    nextValues.length >= 3 &&
    isPriceValue(nextValues[0], nextPositiveLines[0]?.tokens[0] || '') &&
    isQuantityValue(nextValues[1], nextPositiveLines[1]?.tokens[0] || '') &&
    isPriceValue(nextValues[2], nextPositiveLines[2]?.tokens[0] || '')
  ) {
    return {
      unitPrice: nextValues[0],
      quantity: nextValues[1],
      totalPrice: nextValues[2],
      consumedIndexes: [nextPositiveLines[0].index, nextPositiveLines[1].index, nextPositiveLines[2].index],
      reason: '상품명 다음 줄들에서 단가, 수량, 금액 패턴 감지',
      explicitQuantity: true,
      exactMatch: nextValues[0] * nextValues[1] === nextValues[2],
      uncertain: false
    };
  }

  if (
    sameLineNumbers.length === 0 &&
    previousLine &&
    nextValues.length >= 2 &&
    isPriceValue(previousLine.standaloneNumber, previousLine.tokens[0] || '') &&
    isPriceValue(nextValues[0], nextPositiveLines[0]?.tokens[0] || '') &&
    isQuantityValue(nextValues[1], nextPositiveLines[1]?.tokens[0] || '')
  ) {
    const totalFromPrevious = previousLine.standaloneNumber;
    const unitFromNext = nextValues[0];
    const quantityFromNext = nextValues[1];

    if (unitFromNext * quantityFromNext === totalFromPrevious) {
      return {
        unitPrice: unitFromNext,
        quantity: quantityFromNext,
        totalPrice: totalFromPrevious,
        consumedIndexes: [previousLine.index, nextPositiveLines[0].index, nextPositiveLines[1].index],
        reason: '금액이 상품명 위에 있고 단가와 수량이 아래에 있는 패턴 감지',
        explicitQuantity: true,
        exactMatch: true,
        uncertain: false
      };
    }

    if (totalFromPrevious === unitFromNext) {
      return {
        unitPrice: unitFromNext,
        quantity: quantityFromNext,
        totalPrice: unitFromNext * quantityFromNext,
        consumedIndexes: [previousLine.index, nextPositiveLines[0].index, nextPositiveLines[1].index],
        reason: '상품명 위아래 단가를 비교해 수량과 총액을 복원',
        explicitQuantity: true,
        exactMatch: true,
        uncertain: false
      };
    }
  }

  if (sameLineNumbers.length === 1 && nextValues.length === 0) {
    return {
      unitPrice: sameLineNumbers[0].value,
      quantity: 1,
      totalPrice: sameLineNumbers[0].value,
      consumedIndexes: [],
      reason: '상품명과 금액이 같은 줄에 있어 수량 1개로 추정',
      explicitQuantity: false,
      exactMatch: true,
      uncertain: true
    };
  }

  if (
    sameLineNumbers.length === 1 &&
    nextValues.length >= 1 &&
    isQuantityValue(nextValues[0], nextPositiveLines[0]?.tokens[0] || '')
  ) {
    const totalCandidate = nextValues.find((value, index) => {
      if (index === 0) {
        return false;
      }

      return isPriceValue(value, nextPositiveLines[index]?.tokens[0] || '');
    });

    return {
      unitPrice: sameLineNumbers[0].value,
      quantity: nextValues[0],
      totalPrice: totalCandidate || sameLineNumbers[0].value * nextValues[0],
      consumedIndexes: nextPositiveLines
        .filter((nextLine) => [nextValues[0], totalCandidate].includes(nextLine.standaloneNumber))
        .map((nextLine) => nextLine.index),
      reason: totalCandidate
        ? '상품명 줄의 금액과 다음 줄 수량/금액을 연결'
        : '총액이 없어 단가와 수량으로 금액을 계산',
      explicitQuantity: true,
      exactMatch: !totalCandidate || sameLineNumbers[0].value * nextValues[0] === totalCandidate,
      uncertain: true
    };
  }

  return createFallbackAssignment(sameLineNumbers, previousLine, nextPositiveLines);
}

function calculateItemConfidence({
  matchedClassification,
  unitPrice,
  totalPrice,
  quantity,
  explicitQuantity,
  exactMatch,
  uncertain
}) {
  let score = 0.35;

  if (unitPrice !== null) score += 0.18;
  if (totalPrice !== null) score += 0.12;
  if (quantity) score += 0.08;
  if (explicitQuantity) score += 0.08;
  if (matchedClassification) score += 0.07;
  if (exactMatch) score += 0.12;
  if (!explicitQuantity) score -= 0.08;
  if (uncertain) score -= 0.07;
  if (unitPrice === null) score -= 0.2;

  return clampConfidence(score);
}

function buildReceiptReason(baseReason, item) {
  if (!item.discount) {
    return baseReason;
  }

  return `${baseReason}, 할인 ${formatAmount(item.discount)}원 연결`;
}

function createReceiptItem(lineInfos, lineInfo, assignment, warnings) {
  const rawName = cleanRawName(lineInfo.nameText || lineInfo.text);
  const normalizedName = normalizeProductName(rawName);
  const classification = classifyReceiptIngredient(normalizedName);
  const quantity = assignment.quantity || 1;
  const unitPrice = assignment.unitPrice;
  const totalPrice = assignment.totalPrice !== null ? assignment.totalPrice : unitPrice !== null ? unitPrice * quantity : null;
  const confidence = calculateItemConfidence({
    matchedClassification: classification.matched,
    unitPrice,
    totalPrice,
    quantity,
    explicitQuantity: assignment.explicitQuantity,
    exactMatch: assignment.exactMatch,
    uncertain: assignment.uncertain
  });

  if (unitPrice === null) {
    warnings.push(`가격을 찾지 못한 항목: ${rawName}`);
  } else if (assignment.uncertain || !assignment.exactMatch) {
    warnings.push(`가격/수량 복원이 불확실한 항목: ${rawName}`);
  }

  return {
    rawName,
    normalizedName,
    unitPrice,
    quantity,
    totalPrice,
    discount: 0,
    category: classification.category,
    storageType: classification.storageType,
    includeByDefault: classification.includeByDefault,
    confidence,
    reason: assignment.reason,
    lineIndexes: [lineInfo.index, ...assignment.consumedIndexes].sort((left, right) => left - right),
    sourceLines: [lineInfo.text, ...assignment.consumedIndexes.map((index) => lineInfos[index]?.text).filter(Boolean)]
  };
}

function createCandidateId(index) {
  return `receipt-candidate-${index}-${crypto.randomUUID()}`;
}

function sanitizeReceiptItem(item) {
  const { lastDiscountAmount, lastDiscountLineIndex, ...safeItem } = item;
  return safeItem;
}

function buildReceiptCandidate(item, index, today) {
  const quantityText = String(item.quantity || '').trim() || '1';
  const priceSummary = [
    item.quantity ? `${item.quantity}개` : '',
    item.unitPrice !== null ? `단가 ${formatAmount(item.unitPrice)}원` : '',
    item.totalPrice !== null ? `금액 ${formatAmount(item.totalPrice)}원` : '',
    item.discount ? `할인 ${formatAmount(item.discount)}원` : ''
  ]
    .filter(Boolean)
    .join(' / ');

  return {
    id: createCandidateId(index),
    name: item.normalizedName,
    displayName: item.normalizedName,
    normalizedName: item.normalizedName,
    rawName: item.rawName,
    originalName: item.rawName,
    quantity: quantityText,
    originalQuantity: quantityText,
    unit: '개',
    specText: priceSummary || quantityText,
    category: item.category,
    storageType: item.storageType,
    selected: item.includeByDefault,
    includeByDefault: item.includeByDefault,
    confidence: item.confidence,
    needsReview: item.confidence < 0.65,
    purchaseDate: today,
    expiryDate: '',
    memo: '',
    consumed: false,
    source: 'receipt_ocr',
    rawLine: item.sourceLines.join(' | '),
    sourceLine: item.sourceLines[0] || item.rawName,
    originalText: item.sourceLines.join(' | '),
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    discount: item.discount,
    reason: buildReceiptReason(item.reason, item)
  };
}

export function createIngredientCandidates(items = [], today = '') {
  return items.map((item, index) => buildReceiptCandidate(item, index, today));
}

function applyDiscountToLastItem(items, lineInfo, warnings) {
  const lastItem = items[items.length - 1];
  const discountAmount = getDiscountAmount(lineInfo);

  if (!lastItem || discountAmount === null) {
    if (lineInfo.hasDiscountKeyword || lineInfo.isNegativeAmountOnly) {
      warnings.push(`할인 금액 연결 대상이 불분명한 줄: ${lineInfo.text}`);
    }

    return null;
  }

  if (lastItem.lastDiscountAmount === discountAmount && Math.abs((lastItem.lastDiscountLineIndex ?? -10) - lineInfo.index) <= 1) {
    return null;
  }

  lastItem.discount += discountAmount;
  lastItem.lastDiscountAmount = discountAmount;
  lastItem.lastDiscountLineIndex = lineInfo.index;
  return discountAmount;
}

export function isLikelyReceiptText(lines = []) {
  const joinedText = lines.join('\n');
  const receiptSignals = [
    /상품\s*명.*단가.*수량.*금액/i,
    /면세\s*물품가액/i,
    /과세\s*물품가액/i,
    /부가세/i,
    /결제금액/i,
    /\bPOS\b/i
  ];

  const numericLines = lines.filter((line) => /^\-?\d{1,3}(?:,\d{3})*$|^\-?\d+$/.test(line)).length;
  return receiptSignals.some((pattern) => pattern.test(joinedText)) || numericLines >= 6;
}

export function detectItemSection(lines = []) {
  return {
    lines,
    startIndex: lines.length ? 0 : -1,
    endIndex: lines.length,
    detected: false
  };
}

export function removeReceiptNoiseLines(lines = []) {
  return lines.filter((line) => {
    const lineInfo = createLineInfo(line, 0);
    return !(lineInfo.isIgnored && !lineInfo.isDiscountMeta);
  });
}

export function extractReceiptItems(lines = []) {
  const lineInfos = lines.map((line, index) => createLineInfo(line, index));
  const consumedIndexes = new Set();
  const warnings = [];
  const items = [];
  let pendingDiscountContext = null;
  let lastAttachedDiscountAmount = null;

  lineInfos.forEach((lineInfo) => {
    if (consumedIndexes.has(lineInfo.index)) {
      return;
    }

    if (lineInfo.isDiscountMeta && !lineInfo.isNegativeAmountOnly) {
      const inlineDiscountAmount = getDiscountAmount(lineInfo);

      if (inlineDiscountAmount !== null && items.length) {
        if (lastAttachedDiscountAmount === inlineDiscountAmount) {
          pendingDiscountContext = null;
          return;
        }

        items[items.length - 1].discount += inlineDiscountAmount;
        items[items.length - 1].lastDiscountAmount = inlineDiscountAmount;
        items[items.length - 1].lastDiscountLineIndex = lineInfo.index;
        lastAttachedDiscountAmount = inlineDiscountAmount;
      } else {
        pendingDiscountContext = lineInfo.text;
      }

      return;
    }

    if (lineInfo.isNegativeAmountOnly) {
      const attachedAmount = applyDiscountToLastItem(items, lineInfo, warnings);
      lastAttachedDiscountAmount = attachedAmount;
      pendingDiscountContext = null;
      return;
    }

    if (lineInfo.isIgnored || !lineInfo.hasNameText || !lineInfo.nameText) {
      return;
    }

    const assignment = resolveLineAssignment(lineInfos, lineInfo, consumedIndexes);

    if (assignment.unitPrice === null && assignment.totalPrice === null) {
      return;
    }

    const item = createReceiptItem(lineInfos, lineInfo, assignment, warnings);

    items.push(item);
    item.lineIndexes.forEach((index) => consumedIndexes.add(index));

    if (pendingDiscountContext) {
      warnings.push(`할인 설명은 있었지만 금액 줄이 분리되어 있었어요: ${pendingDiscountContext}`);
      pendingDiscountContext = null;
    }

    lastAttachedDiscountAmount = null;
  });

  if (pendingDiscountContext) {
    warnings.push(`할인 금액 연결 대상이 불분명한 줄: ${pendingDiscountContext}`);
  }

  return {
    items: items.map(sanitizeReceiptItem),
    consumedIndexes,
    warnings
  };
}

export function parseReceiptText(rawText = '', today = '') {
  const normalizedText = normalizeReceiptText(rawText);
  const lines = splitReceiptLines(normalizedText);
  const itemSection = detectItemSection(lines);
  const likelyReceipt = isLikelyReceiptText(lines);
  const { items, consumedIndexes, warnings } = extractReceiptItems(itemSection.lines);
  const usefulLines = [...consumedIndexes].sort((left, right) => left - right).map((index) => lines[index]).filter(Boolean);
  const ignoredLines = lines.filter((_, index) => !consumedIndexes.has(index));
  const candidates = likelyReceipt ? createIngredientCandidates(items, today) : [];

  return /** @type {ReceiptParseResult} */ ({
    sourceType: 'receipt',
    normalizedText,
    lines,
    usefulLines,
    ignoredLines,
    warnings,
    items,
    receiptItems: items,
    candidates,
    template: {
      id: items.length ? 'receipt-ocr' : 'generic-text',
      confidence: items.length >= 4 ? 'high' : items.length >= 1 ? 'medium' : 'low'
    },
    itemSection
  });
}
