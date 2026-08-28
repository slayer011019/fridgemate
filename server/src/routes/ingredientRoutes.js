import { Router } from 'express';
import {
  createIngredientHandler,
  createIngredientsBulkHandler,
  deleteIngredientHandler,
  getIngredientSyncStateHandler,
  getIngredientHandler,
  listIngredientsHandler,
  syncIngredientsHandler,
  updateIngredientHandler
} from '../controllers/ingredientController.js';

export const ingredientRoutes = Router();

ingredientRoutes.get('/', listIngredientsHandler);
ingredientRoutes.get('/sync', getIngredientSyncStateHandler);
ingredientRoutes.post('/sync', syncIngredientsHandler);
ingredientRoutes.get('/:id', getIngredientHandler);
ingredientRoutes.post('/', createIngredientHandler);
ingredientRoutes.post('/bulk', createIngredientsBulkHandler);
ingredientRoutes.patch('/:id', updateIngredientHandler);
ingredientRoutes.delete('/:id', deleteIngredientHandler);
