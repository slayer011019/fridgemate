import { classifyCoupangLines } from './import/coupangLineClassifier.js';
import { buildCoupangRows } from './import/coupangRowBuilder.js';
import { extractCoupangProductFields } from './import/coupangFieldExtractor.js';
import {
  createFallbackCandidate,
  createParsedProductCandidate,
  createTodayString
} from './import/importCandidates.js';
import { detectImportTemplate } from './import/detectTemplate.js';
import { parseKurlyOrder } from './import/kurlyParser.js';
import { detectOcrSourceType, OCR_SOURCE_TYPES } from './import/ocrSourceDetector.js';
import { parseReceiptText } from './import/receiptParser.js';

export function parseCoupangOrder(normalizedSource, today, sourceDetection) {
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

    const candidate = createParsedProductCandidate(parsedProduct, index, today);

    if (candidate) {
      candidates.push(candidate);
    }
  });

  const ignoredLines = classifiedLines
    .filter((entry) => !usedLineIndexes.has(entry.index))
    .map((entry) => entry.line);

  if (!candidates.length) {
    ignoredLines.forEach((line, index) => {
      const fallbackCandidate = createFallbackCandidate(line, index, today);

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
    template,
    sourceType: sourceDetection.sourceType,
    sourceConfidence: sourceDetection.confidence,
    sourceScores: sourceDetection.scores
  };
}

export function parseReceiptOcr(normalizedSource, today, sourceDetection) {
  const receiptResult = parseReceiptText(normalizedSource.text || '', today);

  return {
    ...receiptResult,
    classifiedLines: [],
    rows: [],
    template: receiptResult.template,
    sourceType: sourceDetection.sourceType,
    sourceConfidence: sourceDetection.confidence,
    sourceScores: sourceDetection.scores
  };
}

export function parseGenericShoppingOrder(normalizedSource, today, sourceDetection) {
  const genericDetection = {
    ...sourceDetection,
    sourceType:
      sourceDetection.sourceType === OCR_SOURCE_TYPES.UNKNOWN
        ? OCR_SOURCE_TYPES.UNKNOWN
        : OCR_SOURCE_TYPES.GENERIC_SHOPPING_ORDER
  };

  return parseCoupangOrder(normalizedSource, today, genericDetection);
}

export function parseImportText(source) {
  const today = createTodayString();
  const normalizedSource = typeof source === 'string' ? { text: source } : source || {};
  const sourceDetection = detectOcrSourceType(normalizedSource.text || '');

  if (sourceDetection.sourceType === OCR_SOURCE_TYPES.RECEIPT) {
    return parseReceiptOcr(normalizedSource, today, sourceDetection);
  }

  if (sourceDetection.sourceType === OCR_SOURCE_TYPES.KURLY_ORDER) {
    return {
      ...parseKurlyOrder(normalizedSource.text || '', today),
      sourceType: sourceDetection.sourceType,
      sourceConfidence: sourceDetection.confidence,
      sourceScores: sourceDetection.scores
    };
  }

  if (sourceDetection.sourceType === OCR_SOURCE_TYPES.COUPANG_ORDER) {
    return parseCoupangOrder(normalizedSource, today, sourceDetection);
  }

  return parseGenericShoppingOrder(normalizedSource, today, sourceDetection);
}
