import cors from 'cors';
import express from 'express';
import { authRoutes } from './routes/authRoutes.js';
import { ingredientRoutes } from './routes/ingredientRoutes.js';
import { importCorrectionRoutes } from './routes/importCorrectionRoutes.js';
import { recommendationEventRoutes } from './routes/recommendationEventRoutes.js';
import { recipeRoutes } from './routes/recipeRoutes.js';
import { healthRoutes } from './routes/healthRoutes.js';
import { isAllowedOrigin } from './config.js';
import { prismaRequestScope } from './db/prisma.js';
import { optionalAuth } from './middleware/optionalAuth.js';
import { requireAuth } from './middleware/requireAuth.js';
import { csrfProtection } from './middleware/csrfProtection.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
          return;
        }

        const error = new Error('Origin not allowed by CORS.');
        error.status = 403;
        callback(error);
      }
    })
  );
  app.use(csrfProtection);
  app.use(express.json({ limit: '16kb' }));
  app.use(prismaRequestScope);

  app.get('/', (_request, response) => {
    response.json({
      name: 'FridgeMate API',
      status: 'running'
    });
  });

  app.use('/health', healthRoutes);
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/ingredients', requireAuth, ingredientRoutes);
  app.use('/api/import', requireAuth, importCorrectionRoutes);
  app.use('/api/recipes', requireAuth, recipeRoutes);
  app.use('/api/recommendation-events', optionalAuth, recommendationEventRoutes);

  app.use('/api', (_request, response) => {
    response.status(404).json({
      message: 'API route not found.'
    });
  });

  app.use((error, request, response, _next) => {
    const status = error.status || 500;
    const message = status >= 500 ? 'Internal server error.' : error.message;

    if (status >= 500) {
      console.error('[server] request failed', {
        method: request.method,
        path: request.originalUrl,
        errorName: error.name || 'Error',
        errorCode: error.code || null,
        errorMessage: error.message || 'Unknown server error'
      });
    }

    response.status(status).json({
      message
    });
  });

  return app;
}
