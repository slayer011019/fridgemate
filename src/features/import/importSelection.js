import { normalizeIngredientName } from '../ingredients/ingredientDomain';

function getDuplicateKey(item) {
  return normalizeIngredientName(item?.name || item?.normalizedName || item?.displayName || '')
    .toLowerCase()
    .replace(/\s+/g, '');
}

function getDuplicatePriority(item) {
  return (item?.confidence || 0) + (item?.quantity ? 0.2 : 0) + (item?.selected ? 0.05 : 0);
}

function stripImportMetadata(item) {
  const {
    selected,
    sourceLine,
    rawLine,
    displayName,
    normalizedName,
    specText,
    confidence,
    needsReview,
    originalText,
    originalName,
    originalQuantity,
    simplifiedName,
    unit,
    weightOrVolume,
    source,
    rawName,
    includeByDefault,
    unitPrice,
    totalPrice,
    discount,
    reason,
    duplicateKey,
    duplicateInImport,
    duplicateCandidateCount,
    duplicateExistingItems,
    replaceExisting,
    ...importableItem
  } = item;

  const quantityText = String(importableItem.quantity || '').trim();
  const unitText = String(unit || '').trim();

  return {
    ...importableItem,
    quantity:
      unitText && quantityText && !quantityText.includes(unitText) && /^\d+(?:\.\d+)?$/.test(quantityText)
        ? `${quantityText}${unitText}`
        : quantityText
  };
}

export function annotateDuplicateImportItems(items = [], existingIngredients = []) {
  const existingByKey = existingIngredients.reduce((map, ingredient) => {
    const key = getDuplicateKey(ingredient);

    if (!key) {
      return map;
    }

    const current = map.get(key) || [];
    map.set(key, [...current, ingredient]);
    return map;
  }, new Map());

  const itemKeys = items.map((item) => getDuplicateKey(item));
  const countsByKey = itemKeys.reduce((map, key) => {
    if (!key) {
      return map;
    }

    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());
  const bestIndexByKey = items.reduce((map, item, index) => {
    const key = itemKeys[index];

    if (!key) {
      return map;
    }

    const currentIndex = map.get(key);

    if (currentIndex === undefined || getDuplicatePriority(item) > getDuplicatePriority(items[currentIndex])) {
      map.set(key, index);
    }

    return map;
  }, new Map());

  return items.map((item, index) => {
    const duplicateKey = itemKeys[index];
    const duplicateCandidateCount = countsByKey.get(duplicateKey) || 0;
    const duplicateInImport = duplicateCandidateCount > 1;
    const shouldDeselectDuplicate = duplicateInImport && bestIndexByKey.get(duplicateKey) !== index;

    return {
      ...item,
      duplicateKey,
      duplicateInImport,
      duplicateCandidateCount,
      duplicateExistingItems: existingByKey.get(duplicateKey) || [],
      selected: shouldDeselectDuplicate ? false : item.selected
    };
  });
}

export function toImportableItems(items = []) {
  return items
    .filter((item) => item.selected && item.name.trim())
    .map(stripImportMetadata);
}

export function updateImportItem(items = [], id, patch) {
  return items.map((item) => {
    if (item.id !== id) {
      return item;
    }

    return {
      ...item,
      ...patch,
      learnedCorrection: false
    };
  });
}

export function toggleImportItemSelection(items = [], id) {
  return items.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item));
}

export function setImportItemsSelected(items = [], selected) {
  return items.map((item) => ({ ...item, selected }));
}
