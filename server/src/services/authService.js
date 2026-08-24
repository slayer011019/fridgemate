import { serverConfig } from '../config.js';
import { normalizeAuthInput, assertValidLoginInput, assertValidSignupInput } from '../lib/authValidation.js';
import { createHttpError } from '../lib/httpError.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { createAccessToken, parseExpirySeconds } from '../lib/token.js';
import { createRefreshToken, hashRefreshToken } from '../lib/refreshToken.js';
import { randomUUID } from 'node:crypto';
import { setTransactionUserId, withDatabaseScope, withUserDatabaseScope } from '../db/tenantScope.js';

const SIGNUP_CONFLICT_MESSAGE = 'Unable to create account with the provided credentials.';

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

async function createSessionPayload(user, prismaClient) {
  const refreshToken = createRefreshToken();

  await prismaClient.authSession.create({
    data: {
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: buildRefreshExpiryDate(),
      userId: user.id
    }
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

  if (!user) {
    throw createHttpError(401, 'Invalid email or password.');
  }

  const passwordCheck = await verifyPassword(credentials.password, user.passwordHash);

  if (!passwordCheck.matches) {
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
  if (!refreshToken) {
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

  const refreshTokenValue = createRefreshToken();

  const payload = await withDatabaseScope({
    userId: session.userId,
    refreshTokenHash
  }, async (transaction) => {
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
  if (!refreshToken) {
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
