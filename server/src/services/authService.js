import { prisma } from '../db/prisma.js';
import { serverConfig } from '../config.js';
import { normalizeAuthInput, assertValidLoginInput, assertValidSignupInput } from '../lib/authValidation.js';
import { createHttpError } from '../lib/httpError.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { createAccessToken } from '../lib/token.js';

function serializeUser(user) {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function createSessionPayload(user) {
  return {
    token: createAccessToken(
      {
        sub: user.id,
        email: user.email
      },
      {
        secret: serverConfig.jwtSecret,
        expiresIn: serverConfig.jwtExpiresIn
      }
    ),
    user: serializeUser(user)
  };
}

export async function signupUser(input) {
  const credentials = normalizeAuthInput(input);
  assertValidSignupInput(credentials);

  const existingUser = await prisma.user.findUnique({
    where: { email: credentials.email }
  });

  if (existingUser) {
    throw createHttpError(409, 'An account with that email already exists.');
  }

  const user = await prisma.user.create({
    data: {
      email: credentials.email,
      passwordHash: await hashPassword(credentials.password)
    }
  });

  return createSessionPayload(user);
}

export async function loginUser(input) {
  const credentials = normalizeAuthInput(input);
  assertValidLoginInput(credentials);

  const user = await prisma.user.findUnique({
    where: { email: credentials.email }
  });

  if (!user) {
    throw createHttpError(401, 'Invalid email or password.');
  }

  const passwordMatches = await verifyPassword(credentials.password, user.passwordHash);

  if (!passwordMatches) {
    throw createHttpError(401, 'Invalid email or password.');
  }

  return createSessionPayload(user);
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
