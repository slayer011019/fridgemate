const PROTECTED_INGREDIENT_PATTERN =
  /(고추|양파|삼겹살|대파|계란|달걀|두부|콩나물|숙주|시금치|오이|마늘|당근|감자|상추|깻잎|배추|토마토|버섯|사과|바나나|우유|치즈|요거트|김치|어묵|새우|생선|닭|돼지|소고기|쌀|라면|빵)/;

const ADDRESS_PATTERNS = [
  /(특별시|광역시|특별자치시|도|특별자치도).{0,10}(구|군|읍|면|동|로|길)/,
  /(서울시|부산시|대구시|인천시|광주시|대전시|울산시|세종시).{0,10}(구|군|읍|면|동|로|길)/,
  /(경기|강원|충북|충남|전북|전남|경북|경남|제주).{0,10}(시|구|군|읍|면|동|로|길)/,
  /배송지\s*.+/
];

const PHONE_PATTERNS = [/01[016789][-\s]\d{3,4}[-\s]\d{4}/, /0\d{1,2}[-\s]\d{3,4}[-\s]\d{4}/];
const AMOUNT_PATTERN = /(합계|총액|부가세|결제금액|받은금액).*\d/;
const IDENTIFIER_PATTERN = /(승인번호|주문번호|카드번호).*\d/;
const DATE_ONLY_PATTERN = /^\d{4}[-./]\d{1,2}[-./]\d{1,2}$/;

function normalizeLine(line) {
  return String(line || '').trim();
}

export function isGarbageLine(line) {
  const text = normalizeLine(line);

  if (!text || PROTECTED_INGREDIENT_PATTERN.test(text)) {
    return false;
  }

  return (
    ADDRESS_PATTERNS.some((pattern) => pattern.test(text)) ||
    PHONE_PATTERNS.some((pattern) => pattern.test(text)) ||
    AMOUNT_PATTERN.test(text) ||
    IDENTIFIER_PATTERN.test(text) ||
    text.startsWith('배송지') ||
    DATE_ONLY_PATTERN.test(text)
  );
}

export function isGarbageSuspect(line) {
  const text = normalizeLine(line);

  return /^[\d,\s]+원?$/.test(text) || /마트|할인점|슈퍼|편의점/.test(text) || /^[가-힣]{1,2}$/.test(text);
}

export function scoreConfidence({ name, hasQuantity, matchedCanonical, isGarbage, isSuspect }) {
  let score = 0.3;
  const safeName = String(name || '');

  if (matchedCanonical) score += 0.4;
  if (hasQuantity) score += 0.25;
  if (isGarbage) score -= 0.6;
  if (isSuspect) score -= 0.25;
  if (safeName.length <= 1 || safeName.length >= 15) score -= 0.2;
  if (/[가-힣]{2,}/.test(safeName)) score += 0.1;

  return Math.max(0, Math.min(1, score));
}
