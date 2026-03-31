import { classifyCoupangLines } from './import/coupangLineClassifier.js';
import { buildCoupangRows } from './import/coupangRowBuilder.js';
import { extractCoupangProductFields } from './import/coupangFieldExtractor.js';
import { detectImportTemplate } from './import/detectTemplate.js';
import { guessCategory, guessStorageType } from './import/importGuesser.js';
import { normalizeImportedIngredient } from './import/ingredientNormalizer.js';
import { extractSpecTokens, normalizeDisplayName } from './import/titleNormalizer.js';

function createTodayString() {
  return new Date().toISOString().slice(0, 10);
}

function createCandidateFromText(line, index, today) {
  const specTokens = extractSpecTokens(line);
  const displayName = normalizeDisplayName(line);

  if (!displayName || displayName.length < 2) {
    return null;
  }

  const normalizedProduct = normalizeImportedIngredient(displayName, specTokens);
  const category = normalizedProduct.category || guessCategory(normalizedProduct.normalizedName || normalizedProduct.displayName);
  const storageType =
    normalizedProduct.storageType || guessStorageType(normalizedProduct.normalizedName || normalizedProduct.displayName, category);

  return {
    id: `fallback-candidate-${index}-${crypto.randomUUID()}`,
    name: normalizedProduct.displayName,
    displayName: normalizedProduct.displayName,
    normalizedName: normalizedProduct.normalizedName,
    specText: specTokens.join(', ') || normalizedProduct.quantity,
    quantity: normalizedProduct.quantity,
    rawLine: line,
    selected: true,
    category,
    storageType,
    purchaseDate: today,
    expiryDate: '',
    memo: '',
    consumed: false,
    sourceLine: line
  };
}

export function parseImportText(source) {
  const today = createTodayString();
  const normalizedSource = typeof source === 'string' ? { text: source } : source || {};
  const template = detectImportTemplate({
    rawText: normalizedSource.text || '',
    lineItems: normalizedSource.lineItems || []
  });
  const classifiedLines = classifyCoupangLines({
    rawText: normalizedSource.text || '',
    lineItems: normalizedSource.lineItems || []
  });
  const rows = buildCoupangRows(classifiedLines);
  const lines = classifiedLines.map((entry) => entry.line);
  const usefulLines = [];
  const candidates = [];
  const seenNames = new Set();
  const usedLineIndexes = new Set();

  rows.forEach((row, index) => {
    const parsedProduct = extractCoupangProductFields(row, index);

    if (!parsedProduct) {
      return;
    }

    const normalizedName = String(parsedProduct.normalizedName || parsedProduct.name).toLowerCase();

    if (seenNames.has(normalizedName)) {
      return;
    }

    seenNames.add(normalizedName);
    usefulLines.push(parsedProduct.rawRowText || parsedProduct.rawLine);
    row.entries.forEach((entry) => usedLineIndexes.add(entry.index));

    const category = parsedProduct.category || guessCategory(parsedProduct.normalizedName || parsedProduct.name);
    const storageType =
      parsedProduct.storageType || guessStorageType(parsedProduct.normalizedName || parsedProduct.name, category);

    candidates.push({
      id: `candidate-${index}-${crypto.randomUUID()}`,
      name: parsedProduct.displayName || parsedProduct.name,
      displayName: parsedProduct.displayName || parsedProduct.name,
      normalizedName: parsedProduct.normalizedName || parsedProduct.name,
      specText: parsedProduct.specText,
      quantity: parsedProduct.quantity,
      rawLine: parsedProduct.rawLine,
      selected: true,
      category,
      storageType,
      purchaseDate: today,
      expiryDate: '',
      memo: '',
      consumed: false,
      sourceLine: parsedProduct.rawLine
    });
  });

  const ignoredLines = classifiedLines
    .filter((entry) => !usedLineIndexes.has(entry.index))
    .map((entry) => entry.line);

  if (!candidates.length) {
    ignoredLines.forEach((line, index) => {
      const fallbackCandidate = createCandidateFromText(line, index, today);

      if (!fallbackCandidate) {
        return;
      }

      const dedupeKey = String(fallbackCandidate.normalizedName || fallbackCandidate.name).toLowerCase();

      if (seenNames.has(dedupeKey)) {
        return;
      }

      seenNames.add(dedupeKey);
      candidates.push(fallbackCandidate);
    });
  }

  return {
    lines,
    usefulLines,
    ignoredLines,
    candidates,
    classifiedLines,
    rows,
    template
  };
}
