import { classifyCoupangLines } from './import/coupangLineClassifier.js';
import { buildCoupangRows } from './import/coupangRowBuilder.js';
import { extractCoupangProductFields } from './import/coupangFieldExtractor.js';
import {
  createFallbackCandidate,
  createParsedProductCandidate,
  createTodayString
} from './import/importCandidates.js';
import { detectImportTemplate } from './import/detectTemplate.js';

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
    template
  };
}
