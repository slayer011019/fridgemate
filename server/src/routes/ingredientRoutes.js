import { Router } from 'express';
import {
  createIngredientHandler,
  createIngredientsBulkHandler,
  deleteIngredientHandler,
  getIngredientSyncStateHandler,
  getIngredientHandler,
  listIngredientsHandler,
  syncIngredientsHandler,
  updateIngredientHandler
} from '../controllers/ingredientController.js';
import { MAX_INGREDIENT_BATCH_SIZE } from '../lib/ingredientValidation.js';
import { createRateLimit, getClientAddress } from '../middleware/rateLimit.js';

export const ingredientRoutes = Router();

export function getIngredientWriteRateLimitCost(request) {
  const body = request.body;
  const candidateCounts = [body?.changes, body?.items]
    .filter(Array.isArray)
    .map((items) => items.length);
  const itemCount = candidateCounts.length ? Math.max(...candidateCounts) : 1;
  return Math.max(1, Math.min(itemCount, MAX_INGREDIENT_BATCH_SIZE));
}

const ingredientReadUserMinuteRateLimit = createRateLimit({
  scope: 'ingredient-read-user-minute',
  limit: 60,
  windowMs: 60 * 1000,
  key: (request) => `user:${request.auth.userId}`,
  message: 'Too many ingredient reads. Please try again later.'
});

const ingredientReadUserHourRateLimit = createRateLimit({
  scope: 'ingredient-read-user-hour',
  limit: 600,
  windowMs: 60 * 60 * 1000,
  key: (request) => `user:${request.auth.userId}`,
  message: 'Too many ingredient reads. Please try again later.'
});

const ingredientReadClientMinuteRateLimit = createRateLimit({
  scope: 'ingredient-read-client-minute',
  limit: 600,
  windowMs: 60 * 1000,
  key: (request) => `client:${getClientAddress(request)}`,
  message: 'Too many ingredient reads. Please try again later.'
});

const ingredientReadClientHourRateLimit = createRateLimit({
  scope: 'ingredient-read-client-hour',
  limit: 6_000,
  windowMs: 60 * 60 * 1000,
  key: (request) => `client:${getClientAddress(request)}`,
  message: 'Too many ingredient reads. Please try again later.'
});

const ingredientReadRateLimits = [
  ingredientReadUserMinuteRateLimit,
  ingredientReadUserHourRateLimit,
  ingredientReadClientMinuteRateLimit,
  ingredientReadClientHourRateLimit
];

const ingredientWriteUserMinuteRateLimit = createRateLimit({
  scope: 'ingredient-write-user-minute',
  limit: 120,
  windowMs: 60 * 1000,
  key: (request) => `user:${request.auth.userId}`,
  cost: getIngredientWriteRateLimitCost,
  message: 'Too many ingredient changes. Please try again later.'
});

const ingredientWriteUserHourRateLimit = createRateLimit({
  scope: 'ingredient-write-user-hour',
  limit: 2_000,
  windowMs: 60 * 60 * 1000,
  key: (request) => `user:${request.auth.userId}`,
  cost: getIngredientWriteRateLimitCost,
  message: 'Too many ingredient changes. Please try again later.'
});

const ingredientWriteClientMinuteRateLimit = createRateLimit({
  scope: 'ingredient-write-client-minute',
  limit: 1_200,
  windowMs: 60 * 1000,
  key: (request) => `client:${getClientAddress(request)}`,
  cost: getIngredientWriteRateLimitCost,
  message: 'Too many ingredient changes. Please try again later.'
});

const ingredientWriteClientHourRateLimit = createRateLimit({
  scope: 'ingredient-write-client-hour',
  limit: 20_000,
  windowMs: 60 * 60 * 1000,
  key: (request) => `client:${getClientAddress(request)}`,
  cost: getIngredientWriteRateLimitCost,
  message: 'Too many ingredient changes. Please try again later.'
});

const ingredientWriteRateLimits = [
  ingredientWriteUserMinuteRateLimit,
  ingredientWriteUserHourRateLimit,
  ingredientWriteClientMinuteRateLimit,
  ingredientWriteClientHourRateLimit
];

ingredientRoutes.get('/', ...ingredientReadRateLimits, listIngredientsHandler);
ingredientRoutes.get('/sync', ...ingredientReadRateLimits, getIngredientSyncStateHandler);
ingredientRoutes.post('/sync', ...ingredientWriteRateLimits, syncIngredientsHandler);
ingredientRoutes.get('/:id', ...ingredientReadRateLimits, getIngredientHandler);
ingredientRoutes.post('/', ...ingredientWriteRateLimits, createIngredientHandler);
ingredientRoutes.post('/bulk', ...ingredientWriteRateLimits, createIngredientsBulkHandler);
ingredientRoutes.patch('/:id', ...ingredientWriteRateLimits, updateIngredientHandler);
ingredientRoutes.delete('/:id', ...ingredientWriteRateLimits, deleteIngredientHandler);
