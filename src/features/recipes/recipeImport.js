import { normalizeIngredientName as normalizeDomainIngredientName } from '../ingredients/ingredientDomain.js';
import { generateRecipeSearchLinks } from './recipeSearchLinks.js';

const DEFAULT_SECTION = 'main';
const REVIEW_CONFIDENCE_THRESHOLD = 0.7;
const SECTION_SPLIT_PATTERN = /\s*,\s*/u;
const SECTION_MARKER_PATTERN = /^[●·]\s*/u;
const SECTION_HEADER_PATTERN = /^(?:[●·]\s*)?([^:]+?)\s*:\s*(.+)$/u;
const AMOUNT_KEYWORDS = ['약간', '적당량', '조금', '듬뿍'];
const AMOUNT_UNITS = [
  'kg',
  'g',
  'mg',
  'ml',
  'mL',
  'l',
  'L',
  '개',
  '마리',
  '모',
  '컵',
  '큰술',
  '작은술',
  '줄기',
  '쪽',
  '알',
  '장',
  '봉',
  '줌',
  '스푼',
  'T',
  't'
];
const AMOUNT_UNITS_PATTERN = AMOUNT_UNITS.map((unit) => unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
const DISPLAY_AMOUNT_PATTERN = /\(([^)]+)\)\s*$/u;
const QUANTITY_TOKEN_PATTERN =
  /(?:약\s*)?(?:\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+|\d*[½⅓⅔¼¾⅛⅜⅝⅞])\s*(?:kg|g|mg|ml|mL|l|L|개|마리|모|컵|큰술|작은술|줄기|쪽|알|장|봉|줌|스푼|T|t)(?:\([^)]*\))?/u;
const NAME_AND_AMOUNT_PATTERN = new RegExp(
  `^(.+?)\\s+((?:${AMOUNT_KEYWORDS.join('|')})|${QUANTITY_TOKEN_PATTERN.source})$`,
  'u'
);
const NUMERIC_AMOUNT_PATTERN = new RegExp(
  `^(?:약\\s*)?(\\d+(?:\\.\\d+)?(?:\\s+\\d+\\/\\d+)?|\\d+\\/\\d+|\\d*[½⅓⅔¼¾⅛⅜⅝⅞])\\s*(${AMOUNT_UNITS_PATTERN})?$`,
  'u'
);
const UNICODE_FRACTIONS = {
  '½': '1/2',
  '⅓': '1/3',
  '⅔': '2/3',
  '¼': '1/4',
  '¾': '3/4',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8'
};

const NORMALIZE_RULES = [
  { pattern: /^다진\s+마늘$/u, value: '마늘' },
  { pattern: /^다진\s+대파$/u, value: '대파' },
  { pattern: /^저염간장$/u, value: '간장' },
  { pattern: /^달걀$/u, value: '계란' },
  { pattern: /^칵테일새우$/u, value: '새우' },
  { pattern: /^북어채$/u, value: '북어' },
  { pattern: /^무염버터$/u, value: '버터' },
  { pattern: /^멸치액젓$/u, value: '액젓' }
];

const SEASONING_NAMES = new Set([
  '고춧가루',
  '간장',
  '마늘',
  '설탕',
  '참기름',
  '참깨',
  '액젓',
  '요리당',
  '소금',
  '후추'
]);

const LIQUID_NAMES = ['물', '육수', '다시마육수', '멸치육수', '채수', '쌀뜨물'];

/**
 * @typedef {Object} ParsedRecipeIngredient
 * @property {string} section
 * @property {string} rawName
 * @property {string} normalizedName
 * @property {string} amountText
 * @property {number|null} amountValue
 * @property {string} amountUnit
 * @property {string} displayAmount
 * @property {'main'|'seasoning'|'optional'|'garnish'|'liquid'} ingredientType
 * @property {number} confidence
 * @property {boolean} reviewNeeded
 */

/**
 * @typedef {ParsedRecipeIngredient} NormalizedIngredient
 */

/**
 * @typedef {Object} ImportedRecipeNutrition
 * @property {number|null} calories
 * @property {number|null} carbohydrate
 * @property {number|null} protein
 * @property {number|null} fat
 * @property {number|null} sodium
 */

/**
 * @typedef {Object} ImportedRecipe
 * @property {'food_safety_korea'} source
 * @property {string} sourceRecipeId
 * @property {string} name
 * @property {string} category
 * @property {string} cookingMethod
 * @property {string} rawIngredientsText
 * @property {string[]} tags
 * @property {ImportedRecipeNutrition|null} nutrition
 * @property {ParsedRecipeIngredient[]} ingredients
 * @property {string} embeddingText
 * @property {import('./recipeSearchLinks.js').RecipeSearchLinks} searchLinks
 */

function normalizeSpaces(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function trimField(value) {
  return String(value || '').trim();
}

function decodeXmlEntities(value = '') {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gu, '$1')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&amp;/gu, '&');
}

function extractRows(xmlText = '') {
  return [...String(xmlText || '').matchAll(/<row>([\s\S]*?)<\/row>/giu)].map((match) => match[1]);
}

function extractField(rowText, fieldName, { preserveWhitespace = false } = {}) {
  const match = rowText.match(new RegExp(`<${fieldName}>([\\s\\S]*?)<\\/${fieldName}>`, 'iu'));
  const decoded = decodeXmlEntities(match?.[1] || '');

  return preserveWhitespace ? trimField(decoded) : normalizeSpaces(decoded);
}

function parseNutritionNumber(value) {
  const normalized = String(value || '').replace(/,/g, '').trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTags(hashTagText = '') {
  return String(hashTagText || '')
    .split(/[#,\n]/u)
    .map((tag) => normalizeSpaces(tag))
    .filter(Boolean);
}

function removeLeadingRecipeName(rawIngredientsText, recipeName) {
  const normalizedText = normalizeSpaces(rawIngredientsText);
  const normalizedRecipeName = normalizeSpaces(recipeName);

  if (!normalizedRecipeName || !normalizedText.startsWith(normalizedRecipeName)) {
    return normalizedText;
  }

  return normalizeSpaces(normalizedText.slice(normalizedRecipeName.length));
}

function normalizeSectionName(section = '') {
  const cleaned = normalizeSpaces(String(section || '').replace(SECTION_MARKER_PATTERN, ''));

  if (!cleaned) {
    return DEFAULT_SECTION;
  }

  if (cleaned.includes('양념장')) {
    return '양념장';
  }

  if (cleaned.includes('소스')) {
    return '소스';
  }

  if (cleaned.includes('고명')) {
    return '고명';
  }

  if (cleaned.includes('선택') || cleaned.includes('기호')) {
    return 'optional';
  }

  return cleaned;
}

function normalizeFractionToken(value = '') {
  return String(value || '').replace(/[½⅓⅔¼¾⅛⅜⅝⅞]/gu, (match) => ` ${UNICODE_FRACTIONS[match]}`);
}

function parseFractionPart(value = '') {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return null;
  }

  if (/^\d+\/\d+$/u.test(normalized)) {
    const [numerator, denominator] = normalized.split('/').map(Number);
    return denominator ? numerator / denominator : null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAmountValue(value = '') {
  const normalized = normalizeFractionToken(value).trim();

  if (!normalized) {
    return null;
  }

  const parts = normalized.split(/\s+/u).filter(Boolean);
  const summedValue = parts.reduce((total, part) => {
    const parsedPart = parseFractionPart(part);

    if (parsedPart === null) {
      return Number.NaN;
    }

    return total + parsedPart;
  }, 0);

  return Number.isFinite(summedValue) ? summedValue : null;
}

function parseAmountParts(amountText = '') {
  const cleanedAmount = normalizeSpaces(amountText);

  if (!cleanedAmount) {
    return {
      amountText: '',
      amountValue: null,
      amountUnit: '',
      displayAmount: ''
    };
  }

  if (AMOUNT_KEYWORDS.includes(cleanedAmount)) {
    return {
      amountText: cleanedAmount,
      amountValue: null,
      amountUnit: '',
      displayAmount: cleanedAmount
    };
  }

  const displayAmountMatch = cleanedAmount.match(DISPLAY_AMOUNT_PATTERN);
  const displayAmount = displayAmountMatch?.[1] ? normalizeSpaces(displayAmountMatch[1]) : '';
  const numericPortion = displayAmountMatch ? cleanedAmount.slice(0, displayAmountMatch.index).trim() : cleanedAmount;
  const numericMatch = numericPortion.match(NUMERIC_AMOUNT_PATTERN);

  if (!numericMatch) {
    return {
      amountText: cleanedAmount,
      amountValue: null,
      amountUnit: '',
      displayAmount
    };
  }

  return {
    amountText: cleanedAmount,
    amountValue: parseAmountValue(numericMatch[1]),
    amountUnit: numericMatch[2] ? normalizeSpaces(numericMatch[2]) : '',
    displayAmount
  };
}

function splitIngredientNameAndAmount(segment = '') {
  const normalizedSegment = normalizeSpaces(segment);

  if (!normalizedSegment) {
    return {
      rawName: '',
      amountText: '',
      confidence: 0.2
    };
  }

  const nameAndAmountMatch = normalizedSegment.match(NAME_AND_AMOUNT_PATTERN);

  if (!nameAndAmountMatch) {
    return {
      rawName: normalizedSegment,
      amountText: '',
      confidence: 0.62
    };
  }

  return {
    rawName: normalizeSpaces(nameAndAmountMatch[1]),
    amountText: normalizeSpaces(nameAndAmountMatch[2]),
    confidence: 0.9
  };
}

function dedupe(values = []) {
  return [...new Set(values.map((value) => normalizeSpaces(value)).filter(Boolean))];
}

function buildIngredientLine(label, ingredients = []) {
  const names = dedupe(ingredients.map((ingredient) => ingredient.normalizedName));
  return names.length ? `${label}: ${names.join(', ')}` : '';
}

/**
 * @param {string} name
 * @returns {string}
 */
export function normalizeIngredientName(name = '') {
  const cleanedName = normalizeSpaces(String(name || '').replace(/\([^)]*\)/gu, ''));
  const matchedRule = NORMALIZE_RULES.find((rule) => rule.pattern.test(cleanedName));

  if (matchedRule) {
    return matchedRule.value;
  }

  return normalizeDomainIngredientName(cleanedName);
}

/**
 * @param {{ section?: string, rawName?: string, normalizedName?: string }} input
 * @returns {'main'|'seasoning'|'optional'|'garnish'|'liquid'}
 */
export function classifyRecipeIngredientType({ section = DEFAULT_SECTION, rawName = '', normalizedName = '' } = {}) {
  const normalizedSection = normalizeSectionName(section);
  const comparableName = normalizeSpaces(normalizedName || rawName);

  if (normalizedSection === '고명') {
    return 'garnish';
  }

  if (normalizedSection === '양념장' || normalizedSection === '소스') {
    return 'seasoning';
  }

  if (normalizedSection === 'optional') {
    return 'optional';
  }

  if (LIQUID_NAMES.some((value) => comparableName === value || comparableName.endsWith(value))) {
    return 'liquid';
  }

  if (SEASONING_NAMES.has(comparableName)) {
    return 'seasoning';
  }

  return 'main';
}

/**
 * @param {ParsedRecipeIngredient} ingredient
 * @returns {NormalizedIngredient}
 */
export function normalizeRecipeIngredientByRule(ingredient) {
  const rawName = normalizeSpaces(ingredient?.rawName || ingredient?.name || '');
  const normalizedName = normalizeIngredientName(rawName);
  const ingredientType = classifyRecipeIngredientType({
    section: ingredient?.section || DEFAULT_SECTION,
    rawName,
    normalizedName
  });
  const baseConfidence = Number.isFinite(ingredient?.confidence) ? ingredient.confidence : 0.6;
  const confidence = Math.max(0, Math.min(1, normalizedName === rawName ? baseConfidence : Math.max(baseConfidence, 0.82)));

  return {
    ...ingredient,
    rawName,
    normalizedName,
    ingredientType,
    confidence,
    reviewNeeded: confidence < REVIEW_CONFIDENCE_THRESHOLD
  };
}

function parseIngredientSegment(segment, currentSection = DEFAULT_SECTION) {
  const normalizedSegment = normalizeSpaces(segment);
  const { rawName, amountText, confidence: baseConfidence } = splitIngredientNameAndAmount(normalizedSegment);
  const amountParts = parseAmountParts(amountText);
  const normalizedName = normalizeIngredientName(rawName);
  const ingredientType = classifyRecipeIngredientType({
    section: currentSection,
    rawName,
    normalizedName
  });
  const confidence = amountText
    ? amountParts.amountValue !== null || amountParts.displayAmount
      ? 0.96
      : 0.82
    : baseConfidence;

  return normalizeRecipeIngredientByRule({
    section: currentSection,
    rawName,
    normalizedName,
    amountText: amountParts.amountText,
    amountValue: amountParts.amountValue,
    amountUnit: amountParts.amountUnit,
    displayAmount: amountParts.displayAmount,
    ingredientType,
    confidence
  });
}

/**
 * @param {string} rawText
 * @returns {ParsedRecipeIngredient[]}
 */
export function parseRecipeIngredients(rawText = '') {
  const normalizedText = normalizeSpaces(String(rawText || '').replace(/\r?\n/gu, ' '));

  if (!normalizedText) {
    return [];
  }

  const segments = normalizedText
    .split(SECTION_SPLIT_PATTERN)
    .map((segment) => normalizeSpaces(segment))
    .filter(Boolean);
  const ingredients = [];
  let currentSection = DEFAULT_SECTION;

  segments.forEach((segment) => {
    const sectionMatch = segment.match(SECTION_HEADER_PATTERN);
    let ingredientText = segment;

    if (sectionMatch) {
      currentSection = normalizeSectionName(sectionMatch[1]);
      ingredientText = normalizeSpaces(sectionMatch[2]);
    }

    ingredientText = normalizeSpaces(ingredientText.replace(SECTION_MARKER_PATTERN, ''));

    if (!ingredientText) {
      return;
    }

    ingredients.push(parseIngredientSegment(ingredientText, currentSection));
  });

  return ingredients;
}

/**
 * @param {ImportedRecipe|{ name?: string, category?: string, cookingMethod?: string, rawIngredientsText?: string, tags?: string[] }} recipe
 * @param {ParsedRecipeIngredient[]} ingredients
 * @returns {string}
 */
export function buildRecipeEmbeddingText(recipe = {}, ingredients = []) {
  const mainIngredients = ingredients.filter((ingredient) => ingredient.ingredientType === 'main');
  const optionalIngredients = ingredients.filter(
    (ingredient) => ingredient.ingredientType === 'optional' || ingredient.ingredientType === 'garnish'
  );
  const seasoningIngredients = ingredients.filter((ingredient) => ingredient.ingredientType === 'seasoning');
  const liquidIngredients = ingredients.filter((ingredient) => ingredient.ingredientType === 'liquid');
  const rawPreview = normalizeSpaces(recipe.rawIngredientsText || '').slice(0, 180);
  const tags = dedupe(recipe.tags || []);
  const lines = [
    recipe.name ? `메뉴: ${recipe.name}` : '',
    recipe.category ? `분류: ${recipe.category}` : '',
    recipe.cookingMethod ? `조리방식: ${recipe.cookingMethod}` : '',
    buildIngredientLine('핵심재료', mainIngredients),
    buildIngredientLine('보조재료', optionalIngredients),
    buildIngredientLine('양념재료', seasoningIngredients),
    buildIngredientLine('액체재료', liquidIngredients),
    tags.length ? `특징: ${tags.join(', ')}` : '',
    rawPreview ? `원재료요약: ${rawPreview}` : ''
  ];

  return lines.filter(Boolean).join('\n');
}

/**
 * @param {string} xmlText
 * @returns {ImportedRecipe[]}
 */
export function parseFoodSafetyRecipeXml(xmlText = '') {
  return extractRows(xmlText).map((rowText) => {
    const sourceRecipeId = extractField(rowText, 'RCP_SEQ');
    const name = extractField(rowText, 'RCP_NM');
    const rawIngredientsText = extractField(rowText, 'RCP_PARTS_DTLS', { preserveWhitespace: true });
    const category = extractField(rowText, 'RCP_PAT2');
    const cookingMethod = extractField(rowText, 'RCP_WAY2');
    const tags = parseTags(extractField(rowText, 'HASH_TAG', { preserveWhitespace: true }));
    const nutrition = {
      calories: parseNutritionNumber(extractField(rowText, 'INFO_ENG')),
      carbohydrate: parseNutritionNumber(extractField(rowText, 'INFO_CAR')),
      protein: parseNutritionNumber(extractField(rowText, 'INFO_PRO')),
      fat: parseNutritionNumber(extractField(rowText, 'INFO_FAT')),
      sodium: parseNutritionNumber(extractField(rowText, 'INFO_NA'))
    };
    const hasNutrition = Object.values(nutrition).some((value) => value !== null);
    const ingredients = parseRecipeIngredients(removeLeadingRecipeName(rawIngredientsText, name));
    const recipe = {
      source: 'food_safety_korea',
      sourceRecipeId,
      name,
      category,
      cookingMethod,
      rawIngredientsText,
      tags,
      nutrition: hasNutrition ? nutrition : null,
      ingredients,
      searchLinks: generateRecipeSearchLinks(name)
    };

    return {
      ...recipe,
      embeddingText: buildRecipeEmbeddingText(recipe, ingredients)
    };
  });
}
