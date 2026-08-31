import { createProductEvent } from '../services/productEventService.js';

export async function createProductEventHandler(request, response, next) {
  try {
    response.status(201).json(await createProductEvent({ userId: request.auth?.userId, body: request.body }));
  } catch (error) {
    next(error);
  }
}
