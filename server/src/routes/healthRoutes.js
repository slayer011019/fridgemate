import { Router } from 'express';
import { getDatabaseHealth } from '../db/prisma.js';

export const healthRoutes = Router();

healthRoutes.get('/', async (_request, response) => {
  const db = await getDatabaseHealth();

  response.json({
    status: db === 'connected' ? 'ok' : 'degraded',
    db,
    timestamp: new Date().toISOString()
  });
});
