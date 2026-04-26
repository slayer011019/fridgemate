import { Router } from 'express';
import { getCurrentUserHandler, loginHandler, logoutHandler, refreshSessionHandler, signupHandler } from '../controllers/authController.js';
import { createAuthRateLimit } from '../middleware/authRateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const authRoutes = Router();

const signupIpRateLimit = createAuthRateLimit({
  limit: 5,
  windowMs: 15 * 60 * 1000,
  scope: 'signup-ip',
  key: (request) => request.ip || 'unknown'
});

const signupEmailRateLimit = createAuthRateLimit({
  limit: 3,
  windowMs: 15 * 60 * 1000,
  scope: 'signup-email',
  key: (request) => request.body?.email || ''
});

const loginIpRateLimit = createAuthRateLimit({
  limit: 10,
  windowMs: 15 * 60 * 1000,
  scope: 'login-ip',
  key: (request) => request.ip || 'unknown'
});

const loginEmailRateLimit = createAuthRateLimit({
  limit: 5,
  windowMs: 15 * 60 * 1000,
  scope: 'login-email',
  key: (request) => request.body?.email || ''
});

authRoutes.post('/signup', signupIpRateLimit, signupEmailRateLimit, signupHandler);
authRoutes.post('/login', loginIpRateLimit, loginEmailRateLimit, loginHandler);
authRoutes.post('/refresh', refreshSessionHandler);
authRoutes.get('/me', requireAuth, getCurrentUserHandler);
authRoutes.post('/logout', logoutHandler);
