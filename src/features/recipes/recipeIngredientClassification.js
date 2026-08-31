import { normalizeIngredientName as normalizeDomainIngredientName } from '../ingredients/ingredientDomain.js';

export const RECIPE_INGREDIENT_TYPES = Object.freeze([
  'main',
  'seasoning',
  'optional',
  'garnish',
  'liquid',
  'unknown'
]);

const TYPE_PRIORITY = Object.freeze({
  main: 6,
  seasoning: 5,
  liquid: 4,
  optional: 3,
  garnish: 2,
  unknown: 1
});

const EXPLICIT_TYPE_ALIASES = new Map([
  ['main', 'main'],
  ['주재료', 'main'],
  ['필수재료', 'main'],
  ['핵심재료', 'main'],
  ['seasoning', 'seasoning'],
  ['양념', 'seasoning'],
  ['양념장', 'seasoning'],
  ['조미료', 'seasoning'],
  ['optional', 'optional'],
  ['선택', 'optional'],
  ['선택재료', 'optional'],
  ['garnish', 'garnish'],
  ['고명', 'garnish'],
  ['장식', 'garnish'],
  ['liquid', 'liquid'],
  ['액체', 'liquid'],
  ['육수', 'liquid'],
  ['unknown', 'unknown'],
  ['미분류', 'unknown']
]);

const SEASONING_NAMES = new Set([
  '간장',
  '국간장',
  '진간장',
  '맛간장',
  '저염간장',
  '소금',
  '후추',
  '후춧가루',
  '흰후춧가루',
  '설탕',
  '황설탕',
  '알룰로스',
  '식초',
  '참기름',
  '들기름',
  '식용유',
  '올리브유',
  '코코넛오일',
  '고춧가루',
  '고추장',
  '된장',
  '맛술',
  '미림',
  '올리고당',
  '요리당',
  '물엿',
  '액젓',
  '멸치액젓',
  '깨',
  '참깨',
  '통깨',
  '깨소금',
  '마늘가루',
  '생강가루',
  '파슬리가루',
  '바질',
  '바질가루',
  '오레가노',
  '로즈마리',
  '타임',
  '계피가루',
  '파프리카가루',
  '카레가루',
  '굴소스',
  '핫소스',
  '우스터소스',
  '치킨스톡',
  '다시다'
]);

const LIQUID_NAMES = new Set(['물', '생수', '육수', '채수', '멸치육수', '다시마육수', '쌀뜨물', '녹차 우린 물']);
const NORMALIZE_RULES = [
  { pattern: /^다진\s*마늘$/u, value: '마늘' },
  { pattern: /^다진\s*대파$/u, value: '대파' },
  { pattern: /^저염간장$/u, value: '간장' },
  { pattern: /^달걀$/u, value: '계란' },
  { pattern: /^칵테일새우$/u, value: '새우' },
  { pattern: /^북어채$/u, value: '북어' },
  { pattern: /^무염버터$/u, value: '버터' },
  { pattern: /^멸치액젓$/u, value: '액젓' }
];
const OPTIONAL_PATTERN = /(?:\*?\s*선택|기호에\s*따라|취향에\s*따라|생략\s*가능)/u;
const GARNISH_PATTERN = /(?:고명|장식용?|마무리용?|토핑)/u;
const SEASONING_SECTION_PATTERN = /(?:양념장?|소스|조미료)/u;
const MAIN_SECTION_PATTERN = /(?:주재료|필수재료|핵심재료)/u;
const LIQUID_SECTION_PATTERN = /(?:육수|국물|액체)/u;
const MAX_CLASSIFICATION_TEXT_LENGTH = 512;
const QUANTITY_SUFFIX_UNITS = Object.freeze([
  '작은술',
  '큰술',
  '마리',
  '줄기',
  '스푼',
  'kg',
  'mg',
  'ml',
  'mL',
  'cm',
  '개',
  '모',
  '컵',
  '쪽',
  '알',
  '장',
  '봉',
  '줌',
  'g',
  'l',
  'L',
  'T',
  't'
]);
const QUANTITY_FRACTIONS = new Set(['¼', '½', '¾', '⅓', '⅔', '⅛', '⅜', '⅝', '⅞']);

function toBoundedClassificationText(value) {
  const text = String(value || '');
  return text.length <= MAX_CLASSIFICATION_TEXT_LENGTH ? text : '';
}

function stripParentheticalText(value) {
  let depth = 0;
  let output = '';

  for (const character of value) {
    if (character === '(') {
      depth += 1;
      if (depth === 1) output += ' ';
      continue;
    }

    if (character === ')' && depth > 0) {
      depth -= 1;
      continue;
    }

    if (depth === 0) output += character;
  }

  return output;
}

function isAsciiDigit(character) {
  const codePoint = character?.codePointAt(0) ?? -1;
  return codePoint >= 48 && codePoint <= 57;
}

function isQuantityToken(value) {
  let index = 0;

  while (isAsciiDigit(value[index])) index += 1;
  if (index === 0) return false;

  while (index < value.length && './×xX'.includes(value[index])) {
    index += 1;
    const digitStart = index;
    while (isAsciiDigit(value[index])) index += 1;
    if (index === digitStart) return false;
  }

  if (QUANTITY_FRACTIONS.has(value[index])) index += 1;
  return index === value.length;
}

function stripTrailingQuantityAndUnit(value) {
  const text = value.trimEnd();
  const unit = QUANTITY_SUFFIX_UNITS.find((candidate) => text.endsWith(candidate));
  if (!unit) return text;

  const amountEnd = text.slice(0, -unit.length).trimEnd().length;
  let amountStart = amountEnd;

  while (amountStart > 0) {
    const character = text[amountStart - 1];
    if (!isAsciiDigit(character) && !'./×xX'.includes(character) && !QUANTITY_FRACTIONS.has(character)) break;
    amountStart -= 1;
  }

  const amount = text.slice(amountStart, amountEnd);
  const separator = text[amountStart - 1];
  if (!isQuantityToken(amount) || !separator || separator.trim() !== '') return text;

  return text.slice(0, amountStart).trimEnd();
}

function normalizeSpaces(value) {
  return toBoundedClassificationText(value)
    .replace(/<[^>]*>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizeComparable(value) {
  return normalizeSpaces(value).toLocaleLowerCase().replace(/\s+/gu, '');
}

function cleanSectionPrefix(value) {
  const normalized = normalizeSpaces(value)
    .replace(/^[●•·\-–—]+\s*/u, '')
    .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/gu, '')
    .replace(/^(?:재료|주재료|부재료|양념)\s+(?=\S)/u, '');
  const segments = normalized.split(/\s*(?:>|:|：)\s*/u).filter(Boolean);

  return segments.length > 1 ? segments.at(-1) : normalized;
}

/**
 * Removes parser noise while preserving the catalog ingredient name.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeRecipeIngredientName(value) {
  const cleaned = stripTrailingQuantityAndUnit(stripParentheticalText(cleanSectionPrefix(value)))
    .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/gu, '')
    .trim();
  const matchedRule = NORMALIZE_RULES.find((rule) => rule.pattern.test(cleaned));

  return matchedRule ? matchedRule.value : normalizeDomainIngredientName(cleaned);
}

function resolveExplicitType(value) {
  const comparable = normalizeComparable(value);
  return EXPLICIT_TYPE_ALIASES.get(comparable) || '';
}

function isRecipeTitleIngredient(ingredientName, recipeName) {
  const ingredient = normalizeComparable(ingredientName);
  const title = normalizeComparable(recipeName);

  return ingredient.length >= 2 && title.length >= 2 && (title.includes(ingredient) || ingredient.includes(title));
}

/**
 * Classifies a recipe ingredient without mutating catalog data.
 *
 * @param {{
 *   ingredientType?: string,
 *   category?: string,
 *   section?: string,
 *   rawText?: string,
 *   rawName?: string,
 *   normalizedName?: string,
 *   canonicalName?: string,
 *   recipeName?: string,
 *   amount?: number|null,
 *   unit?: string
 * }} input
 * @returns {{type: 'main'|'seasoning'|'optional'|'garnish'|'liquid'|'unknown', confidence: number, reason: string}}
 */
export function classifyRecipeIngredient(input = {}) {
  const explicitType = resolveExplicitType(input.ingredientType) || resolveExplicitType(input.category);

  if (explicitType && explicitType !== 'unknown') {
    return { type: explicitType, confidence: 0.99, reason: 'explicit-category' };
  }

  const section = normalizeSpaces(input.section);
  const rawContext = normalizeSpaces([input.rawText, input.rawName].filter(Boolean).join(' '));

  if (OPTIONAL_PATTERN.test(section) || OPTIONAL_PATTERN.test(rawContext)) {
    return { type: 'optional', confidence: 0.97, reason: 'optional-marker' };
  }

  if (GARNISH_PATTERN.test(section) || GARNISH_PATTERN.test(rawContext)) {
    return { type: 'garnish', confidence: 0.96, reason: 'garnish-marker' };
  }

  if (SEASONING_SECTION_PATTERN.test(section) || SEASONING_SECTION_PATTERN.test(rawContext)) {
    return { type: 'seasoning', confidence: 0.95, reason: 'season-marker' };
  }

  if (LIQUID_SECTION_PATTERN.test(section)) {
    return { type: 'liquid', confidence: 0.94, reason: 'liquid-section' };
  }

  if (MAIN_SECTION_PATTERN.test(section) || MAIN_SECTION_PATTERN.test(rawContext)) {
    return { type: 'main', confidence: 0.95, reason: 'main-marker' };
  }

  const normalizedName = normalizeRecipeIngredientName(
    input.canonicalName || input.normalizedName || input.rawName || input.rawText
  );

  if (
    isRecipeTitleIngredient(normalizedName, input.recipeName) ||
    isRecipeTitleIngredient(input.canonicalName, input.recipeName) ||
    isRecipeTitleIngredient(input.rawName, input.recipeName)
  ) {
    return { type: 'main', confidence: 0.9, reason: 'recipe-title-match' };
  }

  const comparableName = normalizeComparable(normalizedName);
  if (
    LIQUID_NAMES.has(normalizedName) ||
    comparableName.endsWith('육수') ||
    comparableName.endsWith('우린물')
  ) {
    return { type: 'liquid', confidence: 0.94, reason: 'normalized-name-dictionary' };
  }

  const rawComparable = normalizeComparable(input.rawName || input.rawText);
  const isMincedGarlic = rawComparable.includes('다진마늘') || rawComparable.includes('간마늘');
  if (SEASONING_NAMES.has(normalizedName) || isMincedGarlic) {
    return { type: 'seasoning', confidence: 0.92, reason: 'normalized-name-dictionary' };
  }

  const amount = Number(input.amount);
  const unit = normalizeComparable(input.unit);
  const isSubstantialWeight = ['g', 'ml'].includes(unit) && amount >= 10;
  const isCountedIngredient = ['개', '마리', '모', '컵', '줄기', '쪽', '알', '장', '봉', '줌'].includes(unit) && amount > 0;
  if (Number.isFinite(amount) && (isSubstantialWeight || isCountedIngredient)) {
    return { type: 'main', confidence: 0.72, reason: 'substantial-quantity' };
  }

  return { type: 'unknown', confidence: 0.35, reason: 'insufficient-evidence' };
}

/**
 * Deduplicates normalized ingredients while preferring stronger classifications.
 *
 * @param {Array<Object>} ingredients
 * @returns {Array<Object>}
 */
export function dedupeRecipeIngredients(ingredients = []) {
  const byName = new Map();

  ingredients.forEach((ingredient) => {
    const normalizedName = normalizeRecipeIngredientName(
      ingredient?.canonicalName || ingredient?.normalizedName || ingredient?.rawName || ingredient?.rawText
    );
    if (!normalizedName) return;

    const current = byName.get(normalizedName);
    const nextPriority = TYPE_PRIORITY[ingredient?.ingredientType] || 0;
    const currentPriority = TYPE_PRIORITY[current?.ingredientType] || 0;
    const nextConfidence = Number(ingredient?.classificationConfidence || ingredient?.confidence || 0);
    const currentConfidence = Number(current?.classificationConfidence || current?.confidence || 0);

    if (!current || nextPriority > currentPriority || (nextPriority === currentPriority && nextConfidence > currentConfidence)) {
      byName.set(normalizedName, { ...ingredient, normalizedName });
    }
  });

  return [...byName.values()].sort((left, right) => left.normalizedName.localeCompare(right.normalizedName, 'ko'));
}
