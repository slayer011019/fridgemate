import { Router } from 'express';

export const healthRoutes = Router();

export function getHealth(_request, response) {
  response.json({
    status: 'ok'
  });
}

healthRoutes.get('/', getHealth);
