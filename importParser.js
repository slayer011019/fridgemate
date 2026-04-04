// src/utils/importParser.js

const HEADER_KEYWORDS = [
  "배송완료",
  "도착",
  "주문번호",
  "주문일시",
  "결제",
  "총 결제금액",
  "총상품금액",
  "상품금액",
  "할인",
  "쿠폰",
  "적립",
  "배송비",
  "배송지",
  "받는분",
  "수령인",
  "연락처",
  "전화번호",
  "주소",
  "카드",
  "승인",
  "합계",
  "소계",
  "포인트",
  "송장",
  "운송장",
  "환불",
  "교환",
  "결제수단",
];

const ACTION_KEYWORDS = [
  "장바구니 담기",
  "구매하기",
  "재구매",
  "옵션변경",
  "리뷰쓰기",
  "배송조회",
];

const BRAND_TAGS = [
  "로켓프레시",
  "로켓배송",
  "쿠팡",
  "Coupang",
  "판매자배송",
];

const FOOD_KEYWORDS = [
  "두부", "계란", "달걀", "우유", "치즈", "요거트", "버터",
  "부추", "감자", "백오이", "오이", "양파", "당근", "대파",
  "버섯", "느타리", "새송이", "상추", "토마토", "배추",
  "크래미", "어묵", "햄", "베이컨", "닭", "돼지", "소고기",
  "만두", "볶음밥", "라면", "즉석밥", "떡", "소시지", "두유",
  "사과", "바나나", "딸기", "귤", "주스", "콜라", "사이다",
];

const QUANTITY_TOKEN_REGEX =
  /(\d+\s*(개|입|팩|봉|세트|캔|병|구))|(\d+(\.\d+)?\s*(g|kg|ml|l|L))/gi;

const PRICE_REGEX = /\d{1,3}(,\d{3})*\s*원/g;
const DATE_HEADER_REGEX = /배송완료.*도착/;
const ONLY_NUMBER_OR_PRICE_REGEX = /^[\d\s,원]+$/;
const PHONE_REGEX = /\d{2,3}[- ]?\d{3,4}[- ]?\d{4}/;
const ORDER_CODE_REGEX = /^[A-Z0-9-]{8,}$/;

function normalizeLine(line) {
  return line
    .replace(/\t/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/[•·]/g, " ")
    .replace(/^=+\s*/, "")
    .replace(/^#+\s*/, "")
    .trim();
}

function removeBrandTags(line) {
  let result = line;
  BRAND_TAGS.forEach((tag) => {
    result = result.replaceAll(tag, " ");
  });
  return result.replace(/\s{2,}/g, " ").trim();
}

function removeActionWords(line) {
  let result = line;
  ACTION_KEYWORDS.forEach((word) => {
    result = result.replaceAll(word, " ");
  });
  return result.replace(/\s{2,}/g, " ").trim();
}

function containsHeaderKeyword(line) {
  return HEADER_KEYWORDS.some((keyword) => line.includes(keyword));
}

function looksLikeNoise(line) {
  if (!line) return true;
  if (containsHeaderKeyword(line)) return true;
  if (DATE_HEADER_REGEX.test(line)) return true;
  if (ONLY_NUMBER_OR_PRICE_REGEX.test(line)) return true;
  if (PHONE_REGEX.test(line)) return true;
  if (ORDER_CODE_REGEX.test(line)) return true;
  if (line.length < 2) return true;

  return false;
}

function hasFoodSignal(line) {
  return FOOD_KEYWORDS.some((keyword) => line.includes(keyword));
}

function hasQuantitySignal(line) {
  return QUANTITY_TOKEN_REGEX.test(line);
}

function cleanProductLine(line) {
  let cleaned = normalizeLine(line);
  cleaned = removeBrandTags(cleaned);
  cleaned = removeActionWords(cleaned);
  cleaned = cleaned.replace(PRICE_REGEX, " ");
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  return cleaned;
}

function splitByCommaTokens(line) {
  return line
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function isQuantityToken(token) {
  return (
    /^(\d+\s*(개|입|팩|봉|세트|캔|병|구))$/i.test(token) ||
    /^(\d+(\.\d+)?\s*(g|kg|ml|l|L))$/i.test(token)
  );
}

function extractNameAndQuantity(line) {
  const cleaned = cleanProductLine(line);
  const tokens = splitByCommaTokens(cleaned);

  if (tokens.length === 0) {
    return { name: "", quantity: "" };
  }

  const nameParts = [];
  const quantityParts = [];

  for (const token of tokens) {
    if (isQuantityToken(token)) {
      quantityParts.push(token);
    } else {
      nameParts.push(token);
    }
  }

  // 쉼표 구분이 안 된 OCR 대비
  if (quantityParts.length === 0) {
    const quantityMatches = cleaned.match(QUANTITY_TOKEN_REGEX) || [];
    const quantity = [...new Set(quantityMatches.map((v) => v.replace(/\s+/g, "")))].join(", ");

    let name = cleaned;
    quantityMatches.forEach((q) => {
      name = name.replace(q, " ");
    });

    name = name.replace(/\s{2,}/g, " ").replace(/,+/g, " ").trim();

    return {
      name,
      quantity,
    };
  }

  return {
    name: nameParts.join(", ").replace(/\s{2,}/g, " ").trim(),
    quantity: quantityParts.join(", "),
  };
}

function isValidProductCandidate(line) {
  const cleaned = cleanProductLine(line);
  if (looksLikeNoise(cleaned)) return false;

  // 버튼만 남은 경우
  if (ACTION_KEYWORDS.some((word) => cleaned === word)) return false;

  // 상품 후보 조건:
  // 1) 식품 키워드가 있거나
  // 2) 수량 단위가 있고 한글이 포함된 경우
  const hasKorean = /[가-힣]/.test(cleaned);

  if (hasFoodSignal(cleaned)) return true;
  if (hasKorean && hasQuantitySignal(cleaned)) return true;

  return false;
}

function dedupeByNameQuantity(items) {
  const seen = new Set();

  return items.filter((item) => {
    const key = `${item.name}|${item.quantity}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseImportText(rawText) {
  if (!rawText || typeof rawText !== "string") return [];

  const lines = rawText
    .replace(/\r/g, "\n")
    .split("\n")
    .map(normalizeLine)
    .filter(Boolean);

  const parsed = lines
    .filter(isValidProductCandidate)
    .map((line, index) => {
      const { name, quantity } = extractNameAndQuantity(line);

      return {
        id: `parsed-${Date.now()}-${index}`,
        rawLine: line,
        name,
        quantity: quantity || "1개",
        selected: true,
      };
    })
    .filter((item) => item.name && item.name.length >= 2)
    .filter((item) => !containsHeaderKeyword(item.name))
    .filter((item) => !ACTION_KEYWORDS.includes(item.name));

  return dedupeByNameQuantity(parsed);
}