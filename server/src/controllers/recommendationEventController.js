import { createRecommendationEvent } from '../services/recommendationEventService.js';

export async function createRecommendationEventHandler(request, response, next) {
  try {
    const event = await createRecommendationEvent({
      userId: request.auth?.userId || null,
      body: request.body
    });

    response.status(201).json({
      id: event.id,
      createdAt: event.createdAt
    });
  } catch (error) {
    next(error);
  }
}
