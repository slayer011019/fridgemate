import { randomUUID } from 'node:crypto';
import { ingredientCategories, storageTypes } from '../../../src/utils/ingredientOptions.js';
import { createHttpError } from './httpError.js';

const MAX_NAME_LENGTH = 60;
const MAX_QUANTITY_LENGTH = 30;
const MAX_MEMO_LENGTH = 300;

function normalizeText(value, maxLength) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeDate(value) {
  const normalized = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
}

export function normalizeIngredientInput(input = {}) {
  const id = typeof input.id === 'string' && input.id.trim() ? input.id.trim() : undefined;
  const clientId = typeof input.clientId === 'string' && input.clientId.trim() ? input.clientId.trim() : id || randomUUID();

  return {
    id,
    clientId,
    name: normalizeText(input.name, MAX_NAME_LENGTH),
    category: ingredientCategories.includes(input.category) ? input.category : ingredientCategories[0],
    storageType: storageTypes.includes(input.storageType) ? input.storageType : storageTypes[0],
    quantity: normalizeText(input.quantity, MAX_QUANTITY_LENGTH),
    purchaseDate: normalizeDate(input.purchaseDate),
    expiryDate: normalizeDate(input.expiryDate),
    memo: normalizeText(input.memo, MAX_MEMO_LENGTH),
    consumed: Boolean(input.consumed)
  };
}

export function assertValidIngredient(ingredient) {
  if (!ingredient.name) {
    throw createHttpError(400, 'Ingredient name is required.');
  }

  if (!ingredient.clientId) {
    throw createHttpError(400, 'Ingredient client id is required.');
  }

  if (!ingredient.quantity) {
    throw createHttpError(400, 'Ingredient quantity is required.');
  }

  if (ingredient.purchaseDate && ingredient.expiryDate && ingredient.purchaseDate > ingredient.expiryDate) {
    throw createHttpError(400, 'Expiry date cannot be earlier than purchase date.');
  }
}
