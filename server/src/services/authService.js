import { serverConfig } from '../config.js';
import { normalizeAuthInput, assertValidLoginInput, assertValidSignupInput } from '../lib/authValidation.js';
import { createHttpError } from '../lib/httpError.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { createAccessToken, parseExpirySeconds } from '../lib/token.js';
import { createRefreshToken, hashRefreshToken, isValidRefreshToken } from '../lib/refreshToken.js';
import { randomUUID } from 'node:crypto';
import { setTransactionUserId, withDatabaseScope, withUserDatabaseScope } from '../db/tenantScope.js';
import { consumeAuthRateLimit } from './authSecurityStore.js';
import { serializeIngredientForSync } from './ingredientService.js';

const SIGNUP_CONFLICT_MESSAGE = 'Unable to create account with the provided credentials.';
export const MAX_ACTIVE_AUTH_SESSIONS_PER_USER = 8;
export const MAX_AUTH_SESSION_HISTORY_PER_USER = 24;
export const REFRESH_USER_RATE_LIMIT = {
  scope: 'refresh-user-hour',
  limit: 120,
  windowMs: 60 * 60 * 1000
};
export const LOGIN_ACCOUNT_FAILURE_RATE_LIMIT = {
  scope: 'login-account-failure-hour',
  limit: 30,
  windowMs: 60 * 60 * 1000
};
const DUMMY_PASSWORD_HASH =
  'scrypt$v1$N=16384,r=8,p=5$000102030405060708090a0b0c0d0e0f$0155ba8454c9407962ec1bd99adc6db0be1aee2bb4e249d9aadb1c96f3b7753a98cc0c3fe0f822b5a48ea29aec1a9c490cbc63f6619d4f486b5299909ccf4c32';

function serializeUser(user) {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function buildAccessToken(user) {
  return createAccessToken(
    {
      sub: user.id,
      email: user.email,
      jti: randomUUID()
    },
    {
      secret: serverConfig.jwtSecret,
      expiresIn: serverConfig.jwtExpiresIn,
      issuer: serverConfig.jwtIssuer,
      audience: serverConfig.jwtAudience
    }
  );
}

function buildRefreshExpiryDate() {
  return new Date(Date.now() + parseExpirySeconds(serverConfig.refreshTokenExpiresIn) * 1000);
}

async function revokeActiveRefreshSessions(userId, revokedAt = new Date()) {
  await withUserDatabaseScope(userId, (database) =>
    database.authSession.updateMany({
      where: {
        userId,
        revokedAt: null
      },
      data: {
        revokedAt
      }
    })
  );
}

function isActiveSession(session, now) {
  return !session.revokedAt && new Date(session.expiresAt).getTime() > now.getTime();
}

async function lockAuthSessionRetention(database, userId) {
  // Acquire the per-user writer lock before inserting an AuthSession. FOR NO KEY
  // UPDATE conflicts with another cleanup writer but remains compatible with the
  // foreign-key KEY SHARE lock taken by the later session insert.
  await database.$queryRaw`
    SELECT "id"
    FROM "User"
    WHERE "id" = ${userId}
    FOR NO KEY UPDATE
  `;
}

async function enforceAuthSessionRetention(database, userId, { preserveSessionIds = [] } = {}) {
  const sessions = await database.authSession.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      revokedAt: true,
      expiresAt: true
    }
  });
  const currentSessions = Array.isArray(sessions) ? sessions : [];
  const now = new Date();
  const protectedIds = new Set(preserveSessionIds);
  const keptIds = new Set();

  for (const session of currentSessions) {
    if (protectedIds.has(session.id)) keptIds.add(session.id);
  }

  let keptActiveCount = currentSessions.filter(
    (session) => keptIds.has(session.id) && isActiveSession(session, now)
  ).length;

  for (const session of currentSessions) {
    if (!isActiveSession(session, now) || keptIds.has(session.id)) continue;
    if (keptActiveCount >= MAX_ACTIVE_AUTH_SESSIONS_PER_USER) continue;
    keptIds.add(session.id);
    keptActiveCount += 1;
  }

  for (const session of currentSessions) {
    if (isActiveSession(session, now) || keptIds.has(session.id)) continue;
    if (keptIds.size >= MAX_AUTH_SESSION_HISTORY_PER_USER) break;
    keptIds.add(session.id);
  }

  const expiredOrExcessSessions = currentSessions
    .filter((session) => !keptIds.has(session.id))
    .map((session) => session.id);

  if (!expiredOrExcessSessions.length) return;

  await database.authSession.deleteMany({
    where: {
      userId,
      id: { in: expiredOrExcessSessions }
    }
  });
}

async function enforceRefreshUserRateLimit(userId) {
  const result = await consumeAuthRateLimit({
    ...REFRESH_USER_RATE_LIMIT,
    key: `user:${userId}`
  });

  if (result.allowed) return;

  const error = createHttpError(429, 'Too many session refreshes. Please try again later.');
  error.retryAfterSeconds = result.retryAfterSeconds;
  throw error;
}

async function recordLoginAccountFailure(email) {
  const result = await consumeAuthRateLimit({
    ...LOGIN_ACCOUNT_FAILURE_RATE_LIMIT,
    key: email
  });

  if (result.allowed) return;

  const error = createHttpError(429, 'Too many authentication attempts. Please try again later.');
  error.retryAfterSeconds = result.retryAfterSeconds;
  throw error;
}

async function createSessionPayload(user, prismaClient) {
  const refreshToken = createRefreshToken();

  await lockAuthSessionRetention(prismaClient, user.id);
  const session = await prismaClient.authSession.create({
    data: {
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: buildRefreshExpiryDate(),
      userId: user.id
    }
  });
  await enforceAuthSessionRetention(prismaClient, user.id, {
    preserveSessionIds: [session.id]
  });

  return {
    accessToken: buildAccessToken(user),
    refreshToken,
    user: serializeUser(user)
  };
}

export async function signupUser(input) {
  const credentials = normalizeAuthInput(input);
  assertValidSignupInput(credentials);
  const passwordHash = await hashPassword(credentials.password);

  try {
    return await withDatabaseScope({ authEmail: credentials.email }, async (database) => {
      const existingUser = await database.user.findUnique({
        where: { emailNormalized: credentials.email }
      });

      if (existingUser) {
        throw createHttpError(409, SIGNUP_CONFLICT_MESSAGE);
      }

      const user = await database.user.create({
        data: {
          email: credentials.email,
          emailNormalized: credentials.email,
          passwordHash
        }
      });

      await setTransactionUserId(database, user.id);
      return createSessionPayload(user, database);
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      throw createHttpError(409, SIGNUP_CONFLICT_MESSAGE);
    }

    throw error;
  }
}

export async function loginUser(input) {
  const credentials = normalizeAuthInput(input);
  assertValidLoginInput(credentials);
  const user = await withDatabaseScope({ authEmail: credentials.email }, (database) =>
    database.user.findUnique({
      where: { emailNormalized: credentials.email }
    })
  );

  const passwordCheck = await verifyPassword(
    credentials.password,
    user?.passwordHash || DUMMY_PASSWORD_HASH
  );

  if (!user || !passwordCheck.matches) {
    // Keep the account-wide bucket failure-only so distributed guesses are
    // throttled without letting attackers lock out a correct password.
    await recordLoginAccountFailure(credentials.email);
    throw createHttpError(401, 'Invalid email or password.');
  }

  return withDatabaseScope(
    { userId: user.id, authEmail: credentials.email },
    async (database) => {
      if (passwordCheck.needsRehash) {
        await database.user.update({
          where: { id: user.id },
          data: {
            passwordHash: await hashPassword(credentials.password)
          }
        });
      }

      return createSessionPayload(user, database);
    }
  );
}

export async function refreshUserSession(refreshToken) {
  if (!isValidRefreshToken(refreshToken)) {
    throw createHttpError(401, 'The current session is no longer valid.');
  }

  const refreshTokenHash = hashRefreshToken(refreshToken);
  const now = new Date();
  const session = await withDatabaseScope({ refreshTokenHash }, (database) =>
    database.authSession.findUnique({
      where: { tokenHash: refreshTokenHash }
    })
  );

  if (!session) {
    throw createHttpError(401, 'The current session is no longer valid.');
  }

  if (session.revokedAt || session.expiresAt <= now) {
    await revokeActiveRefreshSessions(session.userId, now);
    throw createHttpError(401, 'The current session is no longer valid.');
  }

  const user = await withUserDatabaseScope(session.userId, (database) =>
    database.user.findUnique({
      where: { id: session.userId }
    })
  );

  if (!user) {
    await revokeActiveRefreshSessions(session.userId, now);
    throw createHttpError(401, 'The current session is no longer valid.');
  }

  await enforceRefreshUserRateLimit(session.userId);

  const refreshTokenValue = createRefreshToken();

  const payload = await withDatabaseScope({
    userId: session.userId,
    refreshTokenHash
  }, async (transaction) => {
    await lockAuthSessionRetention(transaction, session.userId);
    const consumedSession = await transaction.authSession.updateMany({
      where: {
        id: session.id,
        revokedAt: null,
        replacedBySessionId: null,
        expiresAt: {
          gt: now
        }
      },
      data: {
        revokedAt: now
      }
    });

    if (consumedSession.count !== 1) {
      return null;
    }

    const nextSession = await transaction.authSession.create({
      data: {
        tokenHash: hashRefreshToken(refreshTokenValue),
        expiresAt: buildRefreshExpiryDate(),
        userId: session.userId
      }
    });

    await transaction.authSession.update({
      where: { id: session.id },
      data: {
        replacedBySessionId: nextSession.id
      }
    });
    await enforceAuthSessionRetention(transaction, session.userId, {
      preserveSessionIds: [session.id, nextSession.id]
    });

    return {
      accessToken: buildAccessToken(user),
      refreshToken: refreshTokenValue,
      user: serializeUser(user)
    };
  });

  if (!payload) {
    await revokeActiveRefreshSessions(session.userId, now);
    throw createHttpError(401, 'The current session is no longer valid.');
  }

  return payload;
}

export async function logoutUser(refreshToken) {
  if (!isValidRefreshToken(refreshToken)) {
    return;
  }

  const refreshTokenHash = hashRefreshToken(refreshToken);
  const session = await withDatabaseScope({ refreshTokenHash }, (database) =>
    database.authSession.findUnique({
      where: { tokenHash: refreshTokenHash }
    })
  );

  if (!session || session.revokedAt) {
    return;
  }

  await withDatabaseScope({ userId: session.userId, refreshTokenHash }, (database) =>
    database.authSession.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date()
      }
    })
  );
}

export async function getCurrentUser(userId) {
  const user = await withUserDatabaseScope(userId, (database) =>
    database.user.findUnique({
      where: { id: userId }
    })
  );

  if (!user) {
    throw createHttpError(401, 'The current session is no longer valid.');
  }

  return serializeUser(user);
}

export async function exportUserData(userId, password) {
  const normalizedPassword = String(password || '');

  if (!normalizedPassword || normalizedPassword.length > 128) {
    throw createHttpError(400, 'Current password is required.');
  }

  return withUserDatabaseScope(userId, async (database) => {
    const user = await database.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw createHttpError(401, 'The current session is no longer valid.');
    }

    const passwordCheck = await verifyPassword(normalizedPassword, user.passwordHash);

    if (!passwordCheck.matches) {
      throw createHttpError(403, 'Current password is incorrect.');
    }

    const ingredientRows = await database.ingredient.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });
    const ingredients = ingredientRows.map(serializeIngredientForSync);
    const importCorrections = await database.importCorrection.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        sourceKey: true,
        sourceText: true,
        correctedName: true,
        category: true,
        storageType: true,
        usageCount: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true
      }
    });
    const recommendationEvents = await database.recommendationEvent.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        recipeId: true,
        catalogRecipeId: true,
        clientEventId: true,
        eventType: true,
        sessionId: true,
        rank: true,
        score: true,
        matchRate: true,
        missingIngredientCount: true,
        urgentMatchCount: true,
        canMakeNow: true,
        source: true,
        metadata: true,
        createdAt: true
      }
    });
    const menuDecisions = await database.menuDecision.findMany({
      where: { userId },
      orderBy: [{ decisionDate: 'asc' }, { id: 'asc' }]
    });
    const pantryOwnerships = await database.pantryOwnership.findMany({
      where: { userId },
      orderBy: { stapleId: 'asc' }
    });
    const preference = await database.userPreference.findUnique({ where: { userId } });
    const productEvents = await database.productEvent.findMany({
      where: { userId },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }]
    });

    return {
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      account: serializeUser(user),
      ingredients,
      importCorrections,
      recommendationEvents,
      menuDecisions,
      pantryOwnerships,
      preference,
      productEvents
    };
  });
}

export async function deleteUserAccount(userId, password) {
  const normalizedPassword = String(password || '');

  if (!normalizedPassword || normalizedPassword.length > 128) {
    throw createHttpError(400, 'Current password is required.');
  }

  return withUserDatabaseScope(userId, async (database) => {
    const user = await database.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw createHttpError(401, 'The current session is no longer valid.');
    }

    const passwordCheck = await verifyPassword(normalizedPassword, user.passwordHash);

    if (!passwordCheck.matches) {
      throw createHttpError(403, 'Current password is incorrect.');
    }

    await database.recommendationEvent.deleteMany({
      where: { userId }
    });
    await database.productEvent.deleteMany({ where: { userId } });
    const deletedUser = await database.user.deleteMany({
      where: { id: userId }
    });

    if (deletedUser.count !== 1) {
      throw createHttpError(409, 'The account could not be deleted. Please try again.');
    }
  });
}
