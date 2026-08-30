import { Router } from 'express';
import {
  getUserPreferenceHandler,
  listPantryOwnershipHandler,
  savePantryOwnershipHandler,
  saveUserPreferenceHandler
} from '../controllers/personalizationController.js';
import { createRateLimit, getClientAddress } from '../middleware/rateLimit.js';

export const pantryOwnershipRoutes = Router();
export const userPreferenceRoutes = Router();

export function getPersonalizationWriteCost(request) {
  const pantryItemCount = Array.isArray(request.body?.items) ? request.body.items.length : 0;
  const preferredCount = Array.isArray(request.body?.preferredIngredients)
    ? request.body.preferredIngredients.length
    : 0;
  const dislikedCount = Array.isArray(request.body?.dislikedIngredients)
    ? request.body.dislikedIngredients.length
    : 0;
  return Math.max(1, Math.min(pantryItemCount + preferredCount + dislikedCount, 100));
}

const personalizationWriteRateLimits = [
  createRateLimit({
    scope: 'personalization-write-user-minute',
    limit: 120,
    windowMs: 60 * 1000,
    key: (request) => `user:${request.auth.userId}`,
    cost: getPersonalizationWriteCost,
    message: 'Too many preference changes. Please try again later.'
  }),
  createRateLimit({
    scope: 'personalization-write-user-hour',
    limit: 1_000,
    windowMs: 60 * 60 * 1000,
    key: (request) => `user:${request.auth.userId}`,
    cost: getPersonalizationWriteCost,
    message: 'Too many preference changes. Please try again later.'
  }),
  createRateLimit({
    scope: 'personalization-write-client-minute',
    limit: 1_200,
    windowMs: 60 * 1000,
    key: (request) => `client:${getClientAddress(request)}`,
    cost: getPersonalizationWriteCost,
    message: 'Too many preference changes. Please try again later.'
  }),
  createRateLimit({
    scope: 'personalization-write-client-hour',
    limit: 10_000,
    windowMs: 60 * 60 * 1000,
    key: (request) => `client:${getClientAddress(request)}`,
    cost: getPersonalizationWriteCost,
    message: 'Too many preference changes. Please try again later.'
  })
];

pantryOwnershipRoutes.get('/', listPantryOwnershipHandler);
pantryOwnershipRoutes.put('/', ...personalizationWriteRateLimits, savePantryOwnershipHandler);
userPreferenceRoutes.get('/', getUserPreferenceHandler);
userPreferenceRoutes.put('/', ...personalizationWriteRateLimits, saveUserPreferenceHandler);
