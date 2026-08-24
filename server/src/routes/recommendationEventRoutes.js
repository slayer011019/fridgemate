import { Router } from 'express';
import { createRecommendationEventHandler } from '../controllers/recommendationEventController.js';
import { createRateLimit, getClientAddress } from '../middleware/rateLimit.js';

export const recommendationEventRoutes = Router();

const recommendationEventRateLimit = createRateLimit({
  scope: 'recommendation-events',
  limit: 120,
  windowMs: 60 * 1000,
  key: (request) => `${request.auth?.userId || 'anonymous'}:${getClientAddress(request)}`,
  message: 'Too many recommendation events. Please try again later.'
});

recommendationEventRoutes.post('/', recommendationEventRateLimit, createRecommendationEventHandler);
