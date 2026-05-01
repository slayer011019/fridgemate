import { getRemainingDays } from '../../utils/date';
import { normalizeIngredientName } from './ingredientDomain';

export const defaultIngredientFilters = {
  query: '',
  category: 'all',
  storageType: 'all',
  sortOrder: 'asc',
  status: 'active'
};

function getExpirySortValue(expiryDate) {
  const remainingDays = getRemainingDays(expiryDate);
  return remainingDays === null ? Number.MAX_SAFE_INTEGER : remainingDays;
}

export function matchesIngredientFilters(ingredient, filters = defaultIngredientFilters) {
  const normalizedQuery = String(filters.query || '').trim().toLowerCase();
  const matchesQuery =
    !normalizedQuery ||
    String(ingredient.name || '').toLowerCase().includes(normalizedQuery) ||
    String(ingredient.memo || '').toLowerCase().includes(normalizedQuery);
  const matchesCategory = filters.category === 'all' || ingredient.category === filters.category;
  const matchesStorage = filters.storageType === 'all' || ingredient.storageType === filters.storageType;
  const matchesStatus =
    filters.status === 'all' ||
    (filters.status === 'active' && !ingredient.consumed) ||
    (filters.status === 'consumed' && ingredient.consumed);

  return matchesQuery && matchesCategory && matchesStorage && matchesStatus;
}

export function sortIngredientsByExpiry(ingredients = [], sortOrder = 'asc') {
  return [...ingredients].sort((left, right) => {
    const leftValue = getExpirySortValue(left.expiryDate);
    const rightValue = getExpirySortValue(right.expiryDate);

    return sortOrder === 'asc' ? leftValue - rightValue : rightValue - leftValue;
  });
}

export function filterIngredients(ingredients = [], filters = defaultIngredientFilters) {
  const filtered = ingredients.filter((ingredient) => matchesIngredientFilters(ingredient, filters));
  return sortIngredientsByExpiry(filtered, filters.sortOrder);
}

export function getActiveIngredients(ingredients = []) {
  return ingredients.filter((ingredient) => !ingredient.consumed);
}

export function getConsumedIngredients(ingredients = []) {
  return ingredients.filter((ingredient) => ingredient.consumed);
}

export function getUpcomingIngredients(ingredients = [], limit = 4) {
  return sortIngredientsByExpiry(getActiveIngredients(ingredients), 'asc').slice(0, limit);
}

function getComparableDateValue(value) {
  return String(value || '').trim() || '0000-00-00';
}

function getDuplicateSortValue(ingredient) {
  return [
    getComparableDateValue(ingredient.purchaseDate),
    getComparableDateValue(ingredient.updatedAt),
    getComparableDateValue(ingredient.createdAt),
    String(ingredient.id || '')
  ].join('|');
}

function getDuplicateGroupKey(ingredient) {
  const normalizedName = normalizeIngredientName(ingredient.name);

  if (!normalizedName) {
    return '';
  }

  return [
    normalizedName.trim().toLowerCase(),
    String(ingredient.category || '').trim().toLowerCase(),
    String(ingredient.storageType || '').trim().toLowerCase()
  ].join('|');
}

export function getDuplicateIngredientGroups(ingredients = []) {
  const groups = new Map();

  getActiveIngredients(ingredients).forEach((ingredient) => {
    const key = getDuplicateGroupKey(ingredient);

    if (!key) {
      return;
    }

    const currentGroup = groups.get(key) || {
      key,
      name: normalizeIngredientName(ingredient.name),
      category: ingredient.category,
      storageType: ingredient.storageType,
      items: []
    };

    currentGroup.items.push(ingredient);
    groups.set(key, currentGroup);
  });

  return [...groups.values()]
    .filter((group) => group.items.length > 1)
    .map((group) => {
      const sortedItems = [...group.items].sort((left, right) =>
        getDuplicateSortValue(right).localeCompare(getDuplicateSortValue(left))
      );

      return {
        ...group,
        items: sortedItems,
        keep: sortedItems[0],
        remove: sortedItems.slice(1)
      };
    });
}

export function getDuplicateIngredientCleanupPlan(ingredients = []) {
  const groups = getDuplicateIngredientGroups(ingredients);
  const removeIds = groups.flatMap((group) => group.remove.map((ingredient) => ingredient.id)).filter(Boolean);

  return {
    groups,
    duplicateGroupCount: groups.length,
    removeIds,
    removeCount: removeIds.length
  };
}
