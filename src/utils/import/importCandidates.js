import { guessCategory, guessStorageType } from './importGuesser.js';
import { normalizeImportedIngredient } from './ingredientNormalizer.js';
import { isGarbageLine, isGarbageSuspect, scoreConfidence } from './receiptGarbageFilter.js';
import { extractSpecTokens, normalizeDisplayName } from './titleNormalizer.js';

function createCandidateId(prefix, index) {
  return `${prefix}-${index}-${crypto.randomUUID()}`;
}

function buildCandidate({
  idPrefix,
  index,
  displayName,
  normalizedName,
  quantity,
  specText,
  category,
  storageType,
  rawLine,
  today,
  confidence = 0.3,
  needsReview = false
}) {
  return {
    id: createCandidateId(idPrefix, index),
    name: displayName,
    displayName,
    normalizedName,
    specText,
    quantity,
    rawLine,
    selected: confidence >= 0.5,
    confidence,
    needsReview,
    category,
    storageType,
    purchaseDate: today,
    expiryDate: '',
    memo: '',
    consumed: false,
    sourceLine: rawLine
  };
}

export function createTodayString() {
  return new Date().toISOString().slice(0, 10);
}

export function createFallbackCandidate(line, index, today) {
  if (isGarbageLine(line)) {
    return null;
  }

  const specTokens = extractSpecTokens(line);
  const displayName = normalizeDisplayName(line);

  if (!displayName || displayName.length < 2) {
    return null;
  }

  const normalizedProduct = normalizeImportedIngredient(displayName, specTokens);
  const category = normalizedProduct.category || guessCategory(normalizedProduct.normalizedName || normalizedProduct.displayName);
  const storageType =
    normalizedProduct.storageType || guessStorageType(normalizedProduct.normalizedName || normalizedProduct.displayName, category);
  const hasQuantity = normalizedProduct.quantity !== null;
  const confidence = scoreConfidence({
    name: normalizedProduct.normalizedName,
    hasQuantity,
    matchedCanonical: normalizedProduct.matchedCanonical,
    isGarbage: false,
    isSuspect: isGarbageSuspect(line)
  });

  return buildCandidate({
    idPrefix: 'fallback-candidate',
    index,
    displayName: normalizedProduct.displayName,
    normalizedName: normalizedProduct.normalizedName,
    quantity: normalizedProduct.quantity,
    specText: specTokens.join(', ') || normalizedProduct.quantity,
    category,
    storageType,
    rawLine: line,
    today,
    confidence,
    needsReview: confidence < 0.5 || !hasQuantity
  });
}

export function createParsedProductCandidate(parsedProduct, index, today) {
  if (isGarbageLine(parsedProduct.rawLine)) {
    return null;
  }

  const category = parsedProduct.category || guessCategory(parsedProduct.normalizedName || parsedProduct.name);
  const storageType =
    parsedProduct.storageType || guessStorageType(parsedProduct.normalizedName || parsedProduct.name, category);
  const hasQuantity = parsedProduct.quantity !== null;
  const confidence = scoreConfidence({
    name: parsedProduct.normalizedName || parsedProduct.name,
    hasQuantity,
    matchedCanonical: parsedProduct.matchedCanonical,
    isGarbage: false,
    isSuspect: isGarbageSuspect(parsedProduct.rawLine)
  });

  return buildCandidate({
    idPrefix: 'candidate',
    index,
    displayName: parsedProduct.displayName || parsedProduct.name,
    normalizedName: parsedProduct.normalizedName || parsedProduct.name,
    quantity: parsedProduct.quantity,
    specText: parsedProduct.specText,
    category,
    storageType,
    rawLine: parsedProduct.rawLine,
    today,
    confidence,
    needsReview: confidence < 0.5 || !hasQuantity
  });
}
