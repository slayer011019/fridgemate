import { Router } from 'express';
import { prisma } from '../db/prisma.js';

export const healthRoutes = Router();

healthRoutes.get('/', async (_request, response) => {
  let database = 'disconnected';

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = 'connected';
  } catch (_error) {
    database = 'error';
  }

  response.json({
    status: database === 'connected' ? 'ok' : 'degraded',
    database
  });
});
