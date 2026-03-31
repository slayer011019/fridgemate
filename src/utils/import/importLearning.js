const IMPORT_CORRECTIONS_STORAGE_KEY = 'fridgemate-import-corrections';
const MAX_CORRECTION_COUNT = 300;

function normalizeKeyPart(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function getBrowserStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

function readCorrectionMap() {
  const storage = getBrowserStorage();

  if (!storage) {
    return {};
  }

  try {
    const rawValue = storage.getItem(IMPORT_CORRECTIONS_STORAGE_KEY);
    return rawValue ? JSON.parse(rawValue) : {};
  } catch {
    return {};
  }
}

function writeCorrectionMap(correctionMap) {
  const storage = getBrowserStorage();

  if (!storage) {
    return;
  }

  storage.setItem(IMPORT_CORRECTIONS_STORAGE_KEY, JSON.stringify(correctionMap));
}

export function getImportCorrectionKey(item) {
  return (
    normalizeKeyPart(item?.normalizedName) ||
    normalizeKeyPart(item?.displayName) ||
    normalizeKeyPart(item?.sourceLine) ||
    ''
  );
}

export function applyImportCorrections(items) {
  const correctionMap = readCorrectionMap();

  return items.map((item) => {
    const correctionKey = getImportCorrectionKey(item);
    const correction = correctionMap[correctionKey];

    if (!correction) {
      return item;
    }

    return {
      ...item,
      name: correction.name || item.name,
      displayName: correction.name || item.displayName || item.name,
      normalizedName: correction.name || item.normalizedName || item.name,
      category: correction.category || item.category,
      storageType: correction.storageType || item.storageType,
      learnedCorrection: true
    };
  });
}

export function saveImportCorrections(items) {
  const correctionMap = readCorrectionMap();
  const nextMap = { ...correctionMap };

  items.forEach((item) => {
    const correctionKey = getImportCorrectionKey(item);

    if (!correctionKey || !item.name) {
      return;
    }

    nextMap[correctionKey] = {
      name: item.name,
      category: item.category,
      storageType: item.storageType,
      updatedAt: new Date().toISOString()
    };
  });

  const trimmedEntries = Object.entries(nextMap)
    .sort((left, right) => String(right[1].updatedAt).localeCompare(String(left[1].updatedAt)))
    .slice(0, MAX_CORRECTION_COUNT);

  writeCorrectionMap(Object.fromEntries(trimmedEntries));
}
