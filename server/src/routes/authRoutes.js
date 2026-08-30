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
import { normalizeEmail } from '../lib/authValidation.js';
import { serverConfig } from '../config.js';

export const authRoutes = Router();

export function enforcePublicSignupPolicy(_request, response, next) {
  if (serverConfig.publicSignupEnabled) {
    next();
    return;
  }

  response.status(503).json({
    message: 'New account registration is temporarily unavailable.'
  });
}

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
  key: (request) => `${getClientAddress(request)}:${request.body?.email || ''}`
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
  key: (request) => `${getClientAddress(request)}:${normalizeEmail(request.body?.email)}`
});

const refreshIpBurstRateLimit = createAuthRateLimit({
  limit: 120,
  windowMs: 60 * 1000,
  scope: 'refresh-ip-minute',
  key: getClientAddress
});

const refreshIpHourlyRateLimit = createAuthRateLimit({
  limit: 1_200,
  windowMs: 60 * 60 * 1000,
  scope: 'refresh-ip-hour',
  key: getClientAddress
});

const logoutIpBurstRateLimit = createAuthRateLimit({
  limit: 120,
  windowMs: 60 * 1000,
  scope: 'logout-ip-minute',
  key: getClientAddress
});

const logoutIpHourlyRateLimit = createAuthRateLimit({
  limit: 1_200,
  windowMs: 60 * 60 * 1000,
  scope: 'logout-ip-hour',
  key: getClientAddress
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

const dataExportIpRateLimit = createAuthRateLimit({
  limit: 10,
  windowMs: 15 * 60 * 1000,
  scope: 'data-export-ip',
  key: getClientAddress
});

const dataExportUserRateLimit = createAuthRateLimit({
  limit: 3,
  windowMs: 15 * 60 * 1000,
  scope: 'data-export-user',
  key: (request) => request.auth?.userId || ''
});

const currentUserRateLimit = createAuthRateLimit({
  limit: 120,
  windowMs: 60 * 1000,
  scope: 'auth-me-user-minute',
  key: (request) => request.auth?.userId || ''
});

const currentUserClientRateLimit = createAuthRateLimit({
  limit: 6_000,
  windowMs: 60 * 1000,
  scope: 'auth-me-client-minute',
  key: getClientAddress
});

// Every route below uses FridgeMate's distributed auth limiter before its expensive handler.
// CodeQL models selected rate-limit packages, not this custom middleware; the complete order
// is asserted in authRoutes.test.js before these targeted suppressions are applied.
// codeql[js/missing-rate-limiting]
authRoutes.post('/signup', enforcePublicSignupPolicy, signupIpRateLimit, signupEmailRateLimit, signupHandler);
// The source-scoped login guards run before password verification. The account bucket is
// consumed separately only after a failed password check.
// codeql[js/missing-rate-limiting]
authRoutes.post('/login', loginIpRateLimit, loginEmailRateLimit, loginHandler);
// codeql[js/missing-rate-limiting]
authRoutes.post('/refresh', refreshIpBurstRateLimit, refreshIpHourlyRateLimit, refreshSessionHandler);
// codeql[js/missing-rate-limiting]
authRoutes.get('/me', currentUserClientRateLimit, requireAuth, currentUserRateLimit, getCurrentUserHandler);
// codeql[js/missing-rate-limiting]
authRoutes.post('/data-export', dataExportIpRateLimit, requireAuth, dataExportUserRateLimit, exportUserDataHandler);
// codeql[js/missing-rate-limiting]
authRoutes.delete('/account', accountDeletionIpRateLimit, requireAuth, accountDeletionUserRateLimit, deleteUserAccountHandler);
// codeql[js/missing-rate-limiting]
authRoutes.post('/logout', logoutIpBurstRateLimit, logoutIpHourlyRateLimit, logoutHandler);
