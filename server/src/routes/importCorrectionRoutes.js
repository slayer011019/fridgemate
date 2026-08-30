import { Router } from 'express';
import {
  getImportCorrectionSuggestionsHandler,
  saveImportCorrectionsHandler
} from '../controllers/importCorrectionController.js';
import { createRateLimit, getClientAddress } from '../middleware/rateLimit.js';

export const importCorrectionRoutes = Router();

const MAX_IMPORT_ITEMS_PER_REQUEST = 30;

export function getImportEmbeddingRateLimitCost(request) {
  const itemCount = Array.isArray(request.body?.items) ? request.body.items.length : 0;
  return Math.max(1, Math.min(itemCount, MAX_IMPORT_ITEMS_PER_REQUEST));
}

const importEmbeddingUserBurstRateLimit = createRateLimit({
  scope: 'import-embedding-user-minute',
  limit: 60,
  windowMs: 60 * 1000,
  key: (request) => `user:${request.auth.userId}`,
  cost: getImportEmbeddingRateLimitCost,
  message: 'Too many import analysis requests. Please try again later.'
});

const importEmbeddingUserHourlyRateLimit = createRateLimit({
  scope: 'import-embedding-user-hour',
  limit: 180,
  windowMs: 60 * 60 * 1000,
  key: (request) => `user:${request.auth.userId}`,
  cost: getImportEmbeddingRateLimitCost,
  message: 'Too many import analysis requests. Please try again later.'
});

const importEmbeddingClientBurstRateLimit = createRateLimit({
  scope: 'import-embedding-client-minute',
  limit: 600,
  windowMs: 60 * 1000,
  key: (request) => `client:${getClientAddress(request)}`,
  cost: getImportEmbeddingRateLimitCost,
  message: 'Too many import analysis requests. Please try again later.'
});

const importEmbeddingClientHourlyRateLimit = createRateLimit({
  scope: 'import-embedding-client-hour',
  limit: 1_800,
  windowMs: 60 * 60 * 1000,
  key: (request) => `client:${getClientAddress(request)}`,
  cost: getImportEmbeddingRateLimitCost,
  message: 'Too many import analysis requests. Please try again later.'
});

const importEmbeddingRateLimits = [
  importEmbeddingUserBurstRateLimit,
  importEmbeddingUserHourlyRateLimit,
  importEmbeddingClientBurstRateLimit,
  importEmbeddingClientHourlyRateLimit
];

importCorrectionRoutes.post(
  '/corrections/suggestions',
  ...importEmbeddingRateLimits,
  getImportCorrectionSuggestionsHandler
);
importCorrectionRoutes.post(
  '/corrections',
  ...importEmbeddingRateLimits,
  saveImportCorrectionsHandler
);
