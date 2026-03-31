import { normalizeIngredientName } from './ingredientNormalizer.js';
import { extractSpecTokens, normalizeDisplayName } from './titleNormalizer.js';

const DEFAULT_SPEC_TEXT = '\u0031\uAC1C';

function buildRawRowText(row) {
  return row.rawLines.map((entry) => entry.line).join(' | ');
}

export function extractCoupangProductFields(row, index = 0) {
  const titleText = row.titleLines.map((entry) => entry.line).join(' ').trim();
  const titleWithBrand = [row.brandLine?.line, titleText].filter(Boolean).join(' ').trim();
  const specTokens = extractSpecTokens(titleText, row.priceLine?.line);
  const displayName = normalizeDisplayName(titleWithBrand);
  const normalizedName = normalizeIngredientName(displayName);
  const specText = specTokens.join(', ') || DEFAULT_SPEC_TEXT;

  if (!displayName || displayName.length < 2) {
    return null;
  }

  return {
    id: `candidate-row-${index}`,
    name: displayName,
    displayName,
    normalizedName,
    specText,
    quantity: specTokens.join(' / ') || DEFAULT_SPEC_TEXT,
    rawRowText: buildRawRowText(row),
    rawLine: buildRawRowText(row),
    selected: true
  };
}
