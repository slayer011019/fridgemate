import { Router } from 'express';
import { serverConfig } from '../config.js';
import { createRecommendationEventHandler } from '../controllers/recommendationEventController.js';
import { createHttpError } from '../lib/httpError.js';
import { authenticatedApiClientRateLimit } from '../middleware/authenticatedApiRateLimit.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { createRateLimit, getClientAddress } from '../middleware/rateLimit.js';

export const recommendationEventRoutes = Router();

export function getRecommendationEventRateLimitKey(request) {
  return request.auth?.userId
    ? `user:${request.auth.userId}`
    : `client:${getClientAddress(request)}`;
}

export function enforceRecommendationEventCollectionPolicy(request, response, next) {
  if (serverConfig.recommendationEventsEnabled !== true) {
    response.status(204).send();
    return;
  }

  next();
}

export function requireRecommendationEventAuthentication(request, _response, next) {
  if (!request.auth?.userId) {
    next(createHttpError(401, 'Authentication is required.'));
    return;
  }

  next();
}

const recommendationEventRateLimit = createRateLimit({
  scope: 'recommendation-events',
  limit: 120,
  windowMs: 60 * 1000,
  key: getRecommendationEventRateLimitKey,
  message: 'Too many recommendation events. Please try again later.'
});

// The disabled policy remains a zero-work 204. On the enabled path, a shared client
// budget runs before optional token/revocation checks, followed by the event budget.
// codeql[js/missing-rate-limiting]
recommendationEventRoutes.post('/', enforceRecommendationEventCollectionPolicy, authenticatedApiClientRateLimit, optionalAuth, recommendationEventRateLimit, requireRecommendationEventAuthentication, createRecommendationEventHandler);
