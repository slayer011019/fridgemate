import { Router } from 'express';
import { createRecommendationEventHandler } from '../controllers/recommendationEventController.js';

export const recommendationEventRoutes = Router();

recommendationEventRoutes.post('/', createRecommendationEventHandler);
