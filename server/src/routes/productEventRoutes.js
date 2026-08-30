import { Router } from 'express';
import { serverConfig } from '../config.js';
import { createProductEventHandler } from '../controllers/productEventController.js';
import { createHttpError } from '../lib/httpError.js';
import { createRateLimit, getClientAddress } from '../middleware/rateLimit.js';

export const productEventRoutes = Router();

export function getProductEventRateLimitKey(request) {
  return request.auth?.userId
    ? `user:${request.auth.userId}`
    : `client:${getClientAddress(request)}`;
}

export function enforceProductEventCollectionPolicy(request, response, next) {
  if (serverConfig.productEventsEnabled !== true) {
    response.status(204).send();
    return;
  }

  next();
}

export function requireProductEventAuthentication(request, _response, next) {
  if (!request.auth?.userId) {
    next(createHttpError(401, 'Authentication is required.'));
    return;
  }

  next();
}

const productEventRateLimit = createRateLimit({
  scope: 'product-events',
  limit: 180,
  windowMs: 60 * 1000,
  key: getProductEventRateLimitKey,
  message: 'Too many product events. Please try again later.'
});

productEventRoutes.post(
  '/',
  enforceProductEventCollectionPolicy,
  productEventRateLimit,
  requireProductEventAuthentication,
  createProductEventHandler
);
