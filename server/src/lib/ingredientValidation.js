import { randomUUID } from 'node:crypto';
import { ingredientCategories, storageTypes } from '../../../src/utils/ingredientOptions.js';
import { createHttpError } from './httpError.js';

const MAX_NAME_LENGTH = 60;
const MAX_QUANTITY_LENGTH = 30;
const MAX_MEMO_LENGTH = 300;
export const MAX_SYNC_FUTURE_SKEW_MS = 5 * 60 * 1000;

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

function normalizeTimestamp(value, fallback = null) {
  if (!value) return fallback;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? fallback : timestamp.toISOString();
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

export function normalizeIngredientSyncInput(input = {}) {
  const ingredient = normalizeIngredientInput(input);
  const updatedAt = normalizeTimestamp(input.updatedAt);

  if (!updatedAt) {
    throw createHttpError(400, 'Ingredient updatedAt is required for sync.');
  }

  return {
    ...ingredient,
    createdAt: normalizeTimestamp(input.createdAt, updatedAt),
    updatedAt,
    deletedAt: normalizeTimestamp(input.deletedAt)
  };
}

export function assertValidIngredientSyncTimestamps(ingredient, now = Date.now()) {
  const updatedAt = Date.parse(ingredient.updatedAt);
  const deletedAt = ingredient.deletedAt ? Date.parse(ingredient.deletedAt) : null;

  if (updatedAt > now + MAX_SYNC_FUTURE_SKEW_MS) {
    throw createHttpError(400, 'Ingredient updatedAt is too far in the future.');
  }

  if (deletedAt !== null && deletedAt > updatedAt) {
    throw createHttpError(400, 'Ingredient deletedAt cannot be later than updatedAt.');
  }
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
