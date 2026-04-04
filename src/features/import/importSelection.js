export function toImportableItems(items = []) {
  return items
    .filter((item) => item.selected && item.name.trim())
    .map(({ selected, sourceLine, rawLine, displayName, normalizedName, specText, ...item }) => item);
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
