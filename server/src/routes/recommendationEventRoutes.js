import { Router } from 'express';
import { createRecommendationEventHandler } from '../controllers/recommendationEventController.js';
import { createRateLimit, getClientAddress } from '../middleware/rateLimit.js';

export const recommendationEventRoutes = Router();

export function getRecommendationEventRateLimitKey(request) {
  if (request.auth?.userId) {
    return `user:${request.auth.userId}`;
  }

  return `anonymous:${getClientAddress(request)}`;
}

const recommendationEventRateLimit = createRateLimit({
  scope: 'recommendation-events',
  limit: 120,
  windowMs: 60 * 1000,
  key: getRecommendationEventRateLimitKey,
  message: 'Too many recommendation events. Please try again later.'
});

recommendationEventRoutes.post('/', recommendationEventRateLimit, createRecommendationEventHandler);
