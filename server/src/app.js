import cors from 'cors';
import express from 'express';
import { ingredientRoutes } from './routes/ingredientRoutes.js';
import { recipeRoutes } from './routes/recipeRoutes.js';
import { healthRoutes } from './routes/healthRoutes.js';
import { serverConfig } from './config.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: serverConfig.clientOrigin
    })
  );
  app.use(express.json());

  app.get('/', (_request, response) => {
    response.json({
      name: 'FridgeMate API',
      status: 'running'
    });
  });

  app.use('/api/health', healthRoutes);
  app.use('/api/ingredients', ingredientRoutes);
  app.use('/api/recipes', recipeRoutes);

  app.use('/api', (_request, response) => {
    response.status(404).json({
      message: 'API route not found.'
    });
  });

  app.use((error, _request, response, _next) => {
    const status = error.status || 500;
    const message = status >= 500 ? 'Internal server error.' : error.message;

    response.status(status).json({
      message
    });
  });

  return app;
}
