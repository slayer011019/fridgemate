import { Router } from 'express';
import {
  deleteUserAccountHandler,
  exportUserDataHandler,
  getCurrentUserHandler,
  loginHandler,
  logoutHandler,
  refreshSessionHandler,
  signupHandler
} from '../controllers/authController.js';
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

const accountDeletionIpRateLimit = createAuthRateLimit({
  limit: 10,
  windowMs: 15 * 60 * 1000,
  scope: 'account-deletion-ip',
  key: getClientAddress
});

const accountDeletionUserRateLimit = createAuthRateLimit({
  limit: 5,
  windowMs: 15 * 60 * 1000,
  scope: 'account-deletion-user',
  key: (request) => request.auth?.userId || ''
});

authRoutes.post('/signup', signupIpRateLimit, signupEmailRateLimit, signupHandler);
authRoutes.post('/login', loginIpRateLimit, loginEmailRateLimit, loginHandler);
authRoutes.post('/refresh', refreshSessionHandler);
authRoutes.get('/me', requireAuth, getCurrentUserHandler);
authRoutes.get('/data-export', requireAuth, exportUserDataHandler);
authRoutes.delete(
  '/account',
  requireAuth,
  accountDeletionIpRateLimit,
  accountDeletionUserRateLimit,
  deleteUserAccountHandler
);
authRoutes.post('/logout', logoutHandler);
