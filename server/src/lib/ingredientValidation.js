import { randomUUID } from 'node:crypto';
import { ingredientCategories, storageTypes } from '../../../src/utils/ingredientOptions.js';
import { createHttpError } from './httpError.js';

const MAX_IDENTIFIER_LENGTH = 128;
const MAX_NAME_LENGTH = 60;
const MAX_OPTION_LENGTH = 40;
const MAX_QUANTITY_LENGTH = 30;
const MAX_MEMO_LENGTH = 300;
const MAX_TIMESTAMP_LENGTH = 64;
export const MAX_INGREDIENT_BATCH_SIZE = 50;
export const MAX_SYNC_FUTURE_SKEW_MS = 5 * 60 * 1000;

export function assertPlainObject(value, label = 'Ingredient') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createHttpError(400, `${label} must be an object.`);
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw createHttpError(400, `${label} must be an object.`);
  }
}

function containsControlCharacter(value) {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 31
      || (codePoint >= 127 && codePoint <= 159)
      || codePoint === 0x2028
      || codePoint === 0x2029;
  });
}

function normalizeText(value, { name, maxLength, collapseWhitespace = true }) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw createHttpError(400, `${name} must be a string.`);
  }
  if (containsControlCharacter(value)) {
    throw createHttpError(400, `${name} must not contain control characters.`);
  }

  const normalized = (collapseWhitespace ? value.replace(/\s+/gu, ' ') : value).trim();
  if (normalized.length > maxLength) {
    throw createHttpError(400, `${name} must be at most ${maxLength} characters.`);
  }
  return normalized;
}

export function normalizeIngredientIdentifier(value, name = 'Ingredient id') {
  return normalizeText(value, {
    name,
    maxLength: MAX_IDENTIFIER_LENGTH,
    collapseWhitespace: false
  });
}

function normalizeDate(value, name) {
  const normalized = normalizeText(value, {
    name,
    maxLength: 10,
    collapseWhitespace: false
  });
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
}

function normalizeTimestamp(value, name, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = normalizeText(value, {
    name,
    maxLength: MAX_TIMESTAMP_LENGTH,
    collapseWhitespace: false
  });
  const timestamp = new Date(normalized);
  return Number.isNaN(timestamp.getTime()) ? fallback : timestamp.toISOString();
}

function normalizeEnum(value, name, values) {
  const normalized = normalizeText(value, { name, maxLength: MAX_OPTION_LENGTH });
  return values.includes(normalized) ? normalized : values[0];
}

function normalizeBoolean(value, name) {
  if (value === undefined || value === null) return false;
  if (typeof value !== 'boolean') {
    throw createHttpError(400, `${name} must be a boolean.`);
  }
  return value;
}

export function assertIngredientBatch(items, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(items)) {
    throw createHttpError(400, `${label} must be an array.`);
  }
  if (!allowEmpty && items.length === 0) {
    throw createHttpError(400, 'At least one ingredient is required.');
  }
  if (items.length > MAX_INGREDIENT_BATCH_SIZE) {
    throw createHttpError(400, `${label} must contain at most ${MAX_INGREDIENT_BATCH_SIZE} items.`);
  }
}

export function normalizeIngredientInput(input) {
  assertPlainObject(input);
  const id = normalizeIngredientIdentifier(input.id) || undefined;
  const clientId = normalizeIngredientIdentifier(input.clientId, 'Ingredient client id') || id || randomUUID();

  return {
    id,
    clientId,
    name: normalizeText(input.name, { name: 'Ingredient name', maxLength: MAX_NAME_LENGTH }),
    category: normalizeEnum(input.category, 'Ingredient category', ingredientCategories),
    storageType: normalizeEnum(input.storageType, 'Ingredient storage type', storageTypes),
    quantity: normalizeText(input.quantity, { name: 'Ingredient quantity', maxLength: MAX_QUANTITY_LENGTH }),
    purchaseDate: normalizeDate(input.purchaseDate, 'Ingredient purchase date'),
    expiryDate: normalizeDate(input.expiryDate, 'Ingredient expiry date'),
    memo: normalizeText(input.memo, { name: 'Ingredient memo', maxLength: MAX_MEMO_LENGTH }),
    consumed: normalizeBoolean(input.consumed, 'Ingredient consumed')
  };
}

export function createScrubbedIngredientTombstone({
  id,
  clientId,
  updatedAt,
  deletedAt
}) {
  return {
    id,
    clientId,
    name: null,
    category: null,
    storageType: null,
    quantity: null,
    purchaseDate: null,
    expiryDate: null,
    memo: null,
    consumed: null,
    createdAt: null,
    updatedAt,
    deletedAt
  };
}

export function normalizeIngredientSyncInput(input) {
  assertPlainObject(input);
  const updatedAt = normalizeTimestamp(input.updatedAt, 'Ingredient updatedAt');

  if (!updatedAt) {
    throw createHttpError(400, 'Ingredient updatedAt is required for sync.');
  }

  const suppliedDeletedAt = input.deletedAt !== undefined && input.deletedAt !== null && input.deletedAt !== '';
  const deletedAt = normalizeTimestamp(input.deletedAt, 'Ingredient deletedAt');
  if (suppliedDeletedAt && !deletedAt) {
    throw createHttpError(400, 'Ingredient deletedAt must be a valid timestamp.');
  }
  if (deletedAt) {
    const id = normalizeIngredientIdentifier(input.id) || undefined;
    const clientId = normalizeIngredientIdentifier(input.clientId, 'Ingredient client id') || id;
    if (!clientId) {
      throw createHttpError(400, 'Ingredient client id is required for a deletion tombstone.');
    }

    return createScrubbedIngredientTombstone({ id, clientId, updatedAt, deletedAt });
  }

  const ingredient = normalizeIngredientInput(input);

  return {
    ...ingredient,
    createdAt: normalizeTimestamp(input.createdAt, 'Ingredient createdAt', updatedAt),
    updatedAt,
    deletedAt: null
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
