import { Router } from 'express';
import {
  cancelMenuDecisionHandler,
  completeMenuDecisionHandler,
  getMenuDecisionHandler,
  selectMenuDecisionHandler
} from '../controllers/menuDecisionController.js';
import { createRateLimit, getClientAddress } from '../middleware/rateLimit.js';

export const menuDecisionRoutes = Router();

const menuDecisionWriteRateLimits = [
  createRateLimit({
    scope: 'menu-decision-write-user-minute',
    limit: 60,
    windowMs: 60 * 1000,
    key: (request) => `user:${request.auth.userId}`,
    message: 'Too many menu changes. Please try again later.'
  }),
  createRateLimit({
    scope: 'menu-decision-write-user-hour',
    limit: 600,
    windowMs: 60 * 60 * 1000,
    key: (request) => `user:${request.auth.userId}`,
    message: 'Too many menu changes. Please try again later.'
  }),
  createRateLimit({
    scope: 'menu-decision-write-client-minute',
    limit: 600,
    windowMs: 60 * 1000,
    key: (request) => `client:${getClientAddress(request)}`,
    message: 'Too many menu changes. Please try again later.'
  }),
  createRateLimit({
    scope: 'menu-decision-write-client-hour',
    limit: 6_000,
    windowMs: 60 * 60 * 1000,
    key: (request) => `client:${getClientAddress(request)}`,
    message: 'Too many menu changes. Please try again later.'
  })
];

menuDecisionRoutes.get('/', getMenuDecisionHandler);
menuDecisionRoutes.put('/:date', ...menuDecisionWriteRateLimits, selectMenuDecisionHandler);
menuDecisionRoutes.patch('/:date/complete', ...menuDecisionWriteRateLimits, completeMenuDecisionHandler);
menuDecisionRoutes.delete('/:date', ...menuDecisionWriteRateLimits, cancelMenuDecisionHandler);
