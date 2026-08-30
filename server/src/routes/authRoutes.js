import { Router } from 'express';
import { getCurrentUserHandler, loginHandler, logoutHandler, refreshSessionHandler, signupHandler } from '../controllers/authController.js';
import { createAuthRateLimit } from '../middleware/authRateLimit.js';
import { getClientAddress } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const authRoutes = Router();

const signupIpRateLimit = createAuthRateLimit({
  limit: 5,
  windowMs: 15 * 60 * 1000,
  scope: 'signup-ip',
  key: getClientAddress
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
  key: getClientAddress
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
