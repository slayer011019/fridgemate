import { Router } from 'express';
import { serverConfig } from '../config.js';
import { createProductEventHandler } from '../controllers/productEventController.js';
import { createHttpError } from '../lib/httpError.js';
import { authenticatedApiClientRateLimit } from '../middleware/authenticatedApiRateLimit.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
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

// The disabled policy remains a zero-work 204. On the enabled path, a shared client
// budget runs before optional token/revocation checks, followed by the event budget.
// codeql[js/missing-rate-limiting]
productEventRoutes.post('/', enforceProductEventCollectionPolicy, authenticatedApiClientRateLimit, optionalAuth, productEventRateLimit, requireProductEventAuthentication, createProductEventHandler);
