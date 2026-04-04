import { Router } from 'express';
import { getCurrentUserHandler, loginHandler, logoutHandler, signupHandler } from '../controllers/authController.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const authRoutes = Router();

authRoutes.post('/signup', signupHandler);
authRoutes.post('/login', loginHandler);
authRoutes.get('/me', requireAuth, getCurrentUserHandler);
authRoutes.post('/logout', requireAuth, logoutHandler);
