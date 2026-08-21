import { prisma } from '../db/prisma.js';
import { serverConfig } from '../config.js';
import { normalizeAuthInput, assertValidLoginInput, assertValidSignupInput } from '../lib/authValidation.js';
import { createHttpError } from '../lib/httpError.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { createAccessToken, parseExpirySeconds } from '../lib/token.js';
import { createRefreshToken, hashRefreshToken } from '../lib/refreshToken.js';
import { randomUUID } from 'node:crypto';

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

async function createSessionPayload(user, prismaClient = prisma) {
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

  const existingUser = await prisma.user.findUnique({
    where: { emailNormalized: credentials.email }
  });

  if (existingUser) {
    await hashPassword(credentials.password);
    throw createHttpError(409, SIGNUP_CONFLICT_MESSAGE);
  }

  try {
    const user = await prisma.user.create({
      data: {
        email: credentials.email,
        emailNormalized: credentials.email,
        passwordHash: await hashPassword(credentials.password)
      }
    });

    return createSessionPayload(user);
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

  const user = await prisma.user.findUnique({
    where: { emailNormalized: credentials.email }
  });

  if (!user) {
    throw createHttpError(401, 'Invalid email or password.');
  }

  const passwordCheck = await verifyPassword(credentials.password, user.passwordHash);

  if (!passwordCheck.matches) {
    throw createHttpError(401, 'Invalid email or password.');
  }

  if (passwordCheck.needsRehash) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(credentials.password)
      }
    });
  }

  return createSessionPayload(user);
}

export async function refreshUserSession(refreshToken) {
  if (!refreshToken) {
    throw createHttpError(401, 'The current session is no longer valid.');
  }

  const refreshTokenHash = hashRefreshToken(refreshToken);
  const now = new Date();
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: refreshTokenHash },
    include: { user: true }
  });

  if (!session) {
    throw createHttpError(401, 'The current session is no longer valid.');
  }

  if (session.revokedAt || session.expiresAt <= now) {
    await prisma.authSession.updateMany({
      where: {
        userId: session.userId,
        revokedAt: null
      },
      data: {
        revokedAt: now
      }
    });
    throw createHttpError(401, 'The current session is no longer valid.');
  }

  const refreshTokenValue = createRefreshToken();

  const payload = await prisma.$transaction(async (transaction) => {
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
        revokedAt: now,
        replacedBySessionId: nextSession.id
      }
    });

    return {
      accessToken: buildAccessToken(session.user),
      refreshToken: refreshTokenValue,
      user: serializeUser(session.user)
    };
  });

  return payload;
}

export async function logoutUser(refreshToken) {
  if (!refreshToken) {
    return;
  }

  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashRefreshToken(refreshToken) }
  });

  if (!session || session.revokedAt) {
    return;
  }

  await prisma.authSession.update({
    where: { id: session.id },
    data: {
      revokedAt: new Date()
    }
  });
}

export async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw createHttpError(401, 'The current session is no longer valid.');
  }

  return serializeUser(user);
}
