import { getRemainingDays } from '../../utils/date';

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
