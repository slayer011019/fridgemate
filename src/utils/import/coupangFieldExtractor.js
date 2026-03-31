import { normalizeImportedIngredient } from './ingredientNormalizer.js';
import { extractSpecTokens, normalizeDisplayName } from './titleNormalizer.js';

const DEFAULT_SPEC_TEXT = '\u0031\uAC1C';

function buildRawRowText(row) {
  return row.rawLines.map((entry) => entry.line).join(' | ');
}

export function extractCoupangProductFields(row, index = 0) {
  const titleText = row.titleLines.map((entry) => entry.line).join(' ').trim();
  const titleWithBrand = [row.brandLine?.line, titleText].filter(Boolean).join(' ').trim();
  const specTokens = extractSpecTokens(titleText, row.priceLine?.line);
  const normalizedDisplayName = normalizeDisplayName(titleWithBrand);
  const normalizedProduct = normalizeImportedIngredient(normalizedDisplayName, specTokens);
  const specText = specTokens.join(', ') || DEFAULT_SPEC_TEXT;

  if (!normalizedProduct.displayName || normalizedProduct.displayName.length < 2) {
    return null;
  }

  return {
    id: `candidate-row-${index}`,
    name: normalizedProduct.displayName,
    displayName: normalizedProduct.displayName,
    normalizedName: normalizedProduct.normalizedName,
    specText,
    quantity: normalizedProduct.quantity,
    category: normalizedProduct.category,
    storageType: normalizedProduct.storageType,
    rawRowText: buildRawRowText(row),
    rawLine: buildRawRowText(row),
    selected: true
  };
}
