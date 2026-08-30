import { scryptSync } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from '../../lib/password.js';
import { createRefreshToken } from '../../lib/refreshToken.js';

const prismaMock = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn()
  },
  authSession: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn()
  },
  ingredient: {
    findMany: vi.fn()
  },
  importCorrection: {
    findMany: vi.fn()
  },
  recommendationEvent: {
    findMany: vi.fn(),
    deleteMany: vi.fn()
  },
  menuDecision: {
    findMany: vi.fn()
  },
  pantryOwnership: {
    findMany: vi.fn()
  },
  userPreference: {
    findUnique: vi.fn()
  },
  productEvent: {
    findMany: vi.fn(),
    deleteMany: vi.fn()
  }
};

prismaMock.$queryRaw = vi.fn().mockResolvedValue([
  {
    isAppRoleMember: true,
    bypassRls: false,
    ownsTenantTables: false
  }
]);
prismaMock.$transaction = vi.fn(async (callback) => callback(prismaMock));

vi.mock('../../db/prisma.js', () => ({
  prisma: prismaMock
}));

describe('authService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.JWT_SECRET = '12345678901234567890123456789012';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/fridgemate';
    process.env.JWT_ISSUER = 'fridgemate-api';
    process.env.JWT_AUDIENCE = 'fridgemate-client';
    process.env.NODE_ENV = 'test';
    prismaMock.authSession.findMany.mockResolvedValue([]);
    const { resetAuthSecurityStoreForTests } = await import('../../services/authSecurityStore.js');
    resetAuthSecurityStoreForTests();
  });

  it('normalizes email uniqueness on signup and stores the normalized column', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    prismaMock.authSession.create.mockResolvedValue({
      id: 'session-1'
    });
    const { signupUser } = await import('../authService.js');

    await signupUser({
      email: ' USER@Example.com ',
      password: 'StrongPassphrase123!'
    });

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { emailNormalized: 'user@example.com' }
    });
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'user@example.com',
          emailNormalized: 'user@example.com'
        })
      })
    );
  });

  it('returns a generic error when signup hits an existing normalized email', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com'
    });
    const { signupUser } = await import('../authService.js');

    await expect(
      signupUser({
        email: 'User@Example.com',
        password: 'StrongPassphrase123!'
      })
    ).rejects.toMatchObject({
      status: 409,
      message: 'Unable to create account with the provided credentials.'
    });
  });

  it('rehashes legacy password hashes after a successful login', async () => {
    const salt = '00112233445566778899aabbccddeeff';
    const legacyHash = `${salt}:${scryptSync('StrongPassphrase123!', salt, 64, {
      N: 16384,
      r: 8,
      p: 1
    }).toString('hex')}`;
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: legacyHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    prismaMock.user.update.mockResolvedValue(null);
    prismaMock.authSession.create.mockResolvedValue({
      id: 'session-2'
    });
    const { loginUser } = await import('../authService.js');

    await loginUser({
      email: 'user@example.com',
      password: 'StrongPassphrase123!'
    });

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        passwordHash: expect.stringMatching(/^scrypt\$v1\$/)
      }
    });
  });

  it('performs the password verification path and returns the same error for a missing user', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const consumeRateLimit = vi.fn(async () => ({
      allowed: true,
      retryAfterSeconds: 0
    }));
    const { setAuthSecurityStoreForTests } = await import('../../services/authSecurityStore.js');
    setAuthSecurityStoreForTests({ consumeRateLimit });
    const { loginUser } = await import('../authService.js');

    await expect(
      loginUser({ email: ' Missing@Example.com ', password: 'StrongPassphrase123!' })
    ).rejects.toMatchObject({ status: 401, message: 'Invalid email or password.' });
    expect(consumeRateLimit).toHaveBeenCalledWith({
      scope: 'login-account-failure-hour',
      key: 'missing@example.com',
      limit: 30,
      windowMs: 60 * 60 * 1000
    });
    expect(prismaMock.authSession.create).not.toHaveBeenCalled();
  });

  it('charges the shared account bucket only for a verified wrong password', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'victim@example.com',
      passwordHash: await hashPassword('StrongPassphrase123!')
    });
    const consumeRateLimit = vi.fn(async () => ({
      allowed: true,
      retryAfterSeconds: 0
    }));
    const { setAuthSecurityStoreForTests } = await import('../../services/authSecurityStore.js');
    setAuthSecurityStoreForTests({ consumeRateLimit });
    const { loginUser } = await import('../authService.js');

    await expect(
      loginUser({ email: ' Victim@Example.com ', password: 'WrongPassphrase123!' })
    ).rejects.toMatchObject({ status: 401, message: 'Invalid email or password.' });

    expect(consumeRateLimit).toHaveBeenCalledTimes(1);
    expect(consumeRateLimit).toHaveBeenCalledWith({
      scope: 'login-account-failure-hour',
      key: 'victim@example.com',
      limit: 30,
      windowMs: 60 * 60 * 1000
    });
    expect(prismaMock.authSession.create).not.toHaveBeenCalled();
  });

  it('returns a generic throttle after the distributed failure budget is exhausted', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const consumeRateLimit = vi.fn(async () => ({
      allowed: false,
      retryAfterSeconds: 3_600
    }));
    const { setAuthSecurityStoreForTests } = await import('../../services/authSecurityStore.js');
    setAuthSecurityStoreForTests({ consumeRateLimit });
    const { loginUser } = await import('../authService.js');

    await expect(
      loginUser({ email: 'unknown@example.com', password: 'WrongPassphrase123!' })
    ).rejects.toMatchObject({
      status: 429,
      message: 'Too many authentication attempts. Please try again later.',
      retryAfterSeconds: 3_600
    });
    expect(prismaMock.authSession.create).not.toHaveBeenCalled();
  });

  it('lets a correct password bypass an exhausted account failure bucket', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'victim@example.com',
      passwordHash: await hashPassword('StrongPassphrase123!'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    prismaMock.authSession.create.mockResolvedValue({ id: 'session-1' });
    const consumeRateLimit = vi.fn(async () => ({
      allowed: false,
      retryAfterSeconds: 3_600
    }));
    const { setAuthSecurityStoreForTests } = await import('../../services/authSecurityStore.js');
    setAuthSecurityStoreForTests({ consumeRateLimit });
    const { loginUser } = await import('../authService.js');

    await expect(
      loginUser({ email: 'victim@example.com', password: 'StrongPassphrase123!' })
    ).resolves.toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      user: { id: 'user-1', email: 'victim@example.com' }
    });
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(prismaMock.authSession.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a refresh request without a cookie before querying the database', async () => {
    const { refreshUserSession } = await import('../authService.js');

    await expect(refreshUserSession()).rejects.toMatchObject({
      status: 401,
      message: 'The current session is no longer valid.'
    });
    expect(prismaMock.authSession.findUnique).not.toHaveBeenCalled();
  });

  it('rejects malformed refresh and logout tokens before querying the database', async () => {
    const { logoutUser, refreshUserSession } = await import('../authService.js');

    await expect(refreshUserSession('attacker-controlled')).rejects.toMatchObject({ status: 401 });
    await expect(logoutUser('attacker-controlled')).resolves.toBeUndefined();
    expect(prismaMock.authSession.findUnique).not.toHaveBeenCalled();
  });

  it('atomically consumes a refresh session before issuing its replacement', async () => {
    const session = {
      id: 'session-1',
      userId: 'user-1',
      revokedAt: null,
      replacedBySessionId: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'user-1',
        email: 'user@example.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
    prismaMock.authSession.findUnique.mockResolvedValue(session);
    prismaMock.user.findUnique.mockResolvedValue(session.user);
    prismaMock.authSession.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.authSession.create.mockResolvedValue({ id: 'session-2' });
    prismaMock.authSession.update.mockResolvedValue(null);
    const { refreshUserSession } = await import('../authService.js');

    const result = await refreshUserSession(createRefreshToken());

    expect(prismaMock.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'session-1',
        revokedAt: null,
        replacedBySessionId: null,
        expiresAt: {
          gt: expect.any(Date)
        }
      },
      data: {
        revokedAt: expect.any(Date)
      }
    });
    expect(prismaMock.authSession.create).toHaveBeenCalledWith({
      data: {
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date),
        userId: 'user-1'
      }
    });
    expect(prismaMock.authSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: {
        replacedBySessionId: 'session-2'
      }
    });
    expect(result).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      user: {
        id: 'user-1',
        email: 'user@example.com'
      }
    });
  });

  it('keeps the current rotation and the newest bounded history while removing excess sessions', async () => {
    const now = Date.now();
    const sessions = [
      {
        id: 'session-new',
        revokedAt: null,
        expiresAt: new Date(now + 60_000),
        createdAt: new Date(now)
      },
      ...Array.from({ length: 25 }, (_, index) => ({
        id: `session-${index + 1}`,
        revokedAt: new Date(now - (index + 1) * 1000),
        expiresAt: new Date(now + 60_000),
        createdAt: new Date(now - (index + 1) * 1000)
      }))
    ];
    prismaMock.authSession.findMany.mockResolvedValue(sessions);
    prismaMock.authSession.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: await hashPassword('StrongPassphrase123!')
    });
    prismaMock.authSession.create.mockResolvedValue({ id: 'session-new' });
    const { loginUser, MAX_AUTH_SESSION_HISTORY_PER_USER } = await import('../authService.js');

    await loginUser({ email: 'user@example.com', password: 'StrongPassphrase123!' });

    expect(MAX_AUTH_SESSION_HISTORY_PER_USER).toBe(24);
    const lockCall = prismaMock.$queryRaw.mock.calls.findIndex(([strings]) =>
      strings.join('').includes('FOR NO KEY UPDATE')
    );
    expect(lockCall).toBeGreaterThanOrEqual(0);
    expect(prismaMock.$queryRaw.mock.invocationCallOrder[lockCall]).toBeLessThan(
      prismaMock.authSession.create.mock.invocationCallOrder[0]
    );
    expect(prismaMock.authSession.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        id: { in: ['session-24', 'session-25'] }
      }
    });
    expect(prismaMock.authSession.deleteMany.mock.invocationCallOrder[0]).toBeGreaterThan(
      prismaMock.authSession.create.mock.invocationCallOrder[0]
    );
  });

  it('rate limits successful refresh attempts by user after the session is identified', async () => {
    const session = {
      id: 'session-1',
      userId: 'user-1',
      revokedAt: null,
      replacedBySessionId: null,
      expiresAt: new Date(Date.now() + 60_000)
    };
    prismaMock.authSession.findUnique.mockResolvedValue(session);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com'
    });
    const { setAuthSecurityStoreForTests } = await import('../../services/authSecurityStore.js');
    setAuthSecurityStoreForTests({
      async consumeRateLimit() {
        return { allowed: false, retryAfterSeconds: 3600 };
      }
    });
    const { refreshUserSession } = await import('../authService.js');

    await expect(refreshUserSession(createRefreshToken())).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 3600
    });
    expect(prismaMock.authSession.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.authSession.create).not.toHaveBeenCalled();
  });

  it('retains the just-rotated session record while pruning older history for reuse detection', async () => {
    const now = Date.now();
    const session = {
      id: 'session-old',
      userId: 'user-1',
      revokedAt: null,
      replacedBySessionId: null,
      expiresAt: new Date(now + 60_000)
    };
    prismaMock.authSession.findUnique.mockResolvedValue(session);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com'
    });
    prismaMock.authSession.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.authSession.create.mockResolvedValue({ id: 'session-new' });
    prismaMock.authSession.update.mockResolvedValue(null);
    prismaMock.authSession.findMany.mockResolvedValue([
      {
        id: 'session-new',
        revokedAt: null,
        expiresAt: new Date(now + 60_000),
        createdAt: new Date(now)
      },
      {
        id: 'session-old',
        revokedAt: new Date(now),
        expiresAt: new Date(now + 60_000),
        createdAt: new Date(now - 1000)
      },
      ...Array.from({ length: 22 }, (_, index) => ({
        id: `session-history-${index + 1}`,
        revokedAt: new Date(now - (index + 2) * 1000),
        expiresAt: new Date(now + 60_000),
        createdAt: new Date(now - (index + 2) * 1000)
      })),
      {
        id: 'session-prune',
        revokedAt: new Date(now - 60_000),
        expiresAt: new Date(now + 60_000),
        createdAt: new Date(now - 60_000)
      }
    ]);
    prismaMock.authSession.deleteMany.mockResolvedValue({ count: 1 });
    const { refreshUserSession } = await import('../authService.js');

    await refreshUserSession(createRefreshToken());

    expect(prismaMock.authSession.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        id: { in: ['session-prune'] }
      }
    });
    expect(prismaMock.authSession.update.mock.invocationCallOrder[0]).toBeLessThan(
      prismaMock.authSession.deleteMany.mock.invocationCallOrder[0]
    );
  });

  it('rejects refresh-token reuse and revokes the user refresh sessions', async () => {
    const session = {
      id: 'session-1',
      userId: 'user-1',
      revokedAt: null,
      replacedBySessionId: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'user-1',
        email: 'user@example.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
    prismaMock.authSession.findUnique.mockResolvedValue(session);
    prismaMock.user.findUnique.mockResolvedValue(session.user);
    prismaMock.authSession.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    const { refreshUserSession } = await import('../authService.js');

    await expect(refreshUserSession(createRefreshToken())).rejects.toMatchObject({
      status: 401,
      message: 'The current session is no longer valid.'
    });

    expect(prismaMock.authSession.create).not.toHaveBeenCalled();
    expect(prismaMock.authSession.updateMany).toHaveBeenLastCalledWith({
      where: {
        userId: 'user-1',
        revokedAt: null
      },
      data: {
        revokedAt: expect.any(Date)
      }
    });
  });

  it('exports only the authenticated user data without password or session secrets', async () => {
    const passwordHash = await hashPassword('StrongPassphrase123!');
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      passwordHash,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-02T00:00:00.000Z')
    });
    prismaMock.ingredient.findMany.mockResolvedValue([
      { id: 'ingredient-1', userId: 'user-1' },
      {
        id: 'deleted-ingredient',
        clientId: 'deleted-client',
        userId: 'user-1',
        name: 'legacy private name',
        memo: 'legacy private memo',
        updatedAt: new Date('2026-08-02T00:00:00.000Z'),
        deletedAt: new Date('2026-08-02T00:00:00.000Z')
      }
    ]);
    prismaMock.importCorrection.findMany.mockResolvedValue([{ id: 'correction-1' }]);
    prismaMock.recommendationEvent.findMany.mockResolvedValue([{ id: 'event-1' }]);
    prismaMock.menuDecision.findMany.mockResolvedValue([{ id: 'decision-1' }]);
    prismaMock.pantryOwnership.findMany.mockResolvedValue([{ id: 'pantry-1' }]);
    prismaMock.userPreference.findUnique.mockResolvedValue({ id: 'preference-1' });
    prismaMock.productEvent.findMany.mockResolvedValue([{ id: 'product-event-1' }]);
    const { exportUserData } = await import('../authService.js');

    const result = await exportUserData('user-1', 'StrongPassphrase123!');

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' }
    });
    expect(prismaMock.ingredient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } })
    );
    expect(prismaMock.recommendationEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({ clientEventId: true, catalogRecipeId: true })
    }));
    expect(result).toMatchObject({
      schemaVersion: 2,
      account: { id: 'user-1', email: 'user@example.com' },
      ingredients: [
        { id: 'ingredient-1', userId: 'user-1' },
        {
          id: 'deleted-ingredient',
          clientId: 'deleted-client',
          userId: 'user-1',
          updatedAt: new Date('2026-08-02T00:00:00.000Z'),
          deletedAt: new Date('2026-08-02T00:00:00.000Z')
        }
      ],
      importCorrections: [{ id: 'correction-1' }],
      recommendationEvents: [{ id: 'event-1' }],
      menuDecisions: [{ id: 'decision-1' }],
      pantryOwnerships: [{ id: 'pantry-1' }],
      preference: { id: 'preference-1' },
      productEvents: [{ id: 'product-event-1' }]
    });
    expect(result.account).not.toHaveProperty('passwordHash');
    expect(result.ingredients[1]).not.toHaveProperty('name');
    expect(result.ingredients[1]).not.toHaveProperty('memo');
  });

  it('does not read export datasets when the current password is wrong', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: await hashPassword('StrongPassphrase123!')
    });
    const { exportUserData } = await import('../authService.js');

    await expect(exportUserData('user-1', 'WrongPassphrase123!')).rejects.toMatchObject({
      status: 403,
      message: 'Current password is incorrect.'
    });
    expect(prismaMock.ingredient.findMany).not.toHaveBeenCalled();
    expect(prismaMock.importCorrection.findMany).not.toHaveBeenCalled();
  });

  it('requires the current password and deletes linked recommendation events before the user', async () => {
    const passwordHash = await hashPassword('StrongPassphrase123!');
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      passwordHash
    });
    prismaMock.recommendationEvent.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.productEvent.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.user.deleteMany.mockResolvedValue({ count: 1 });
    const { deleteUserAccount } = await import('../authService.js');

    await expect(deleteUserAccount('user-1', 'StrongPassphrase123!')).resolves.toBeUndefined();

    expect(prismaMock.recommendationEvent.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' }
    });
    expect(prismaMock.user.deleteMany).toHaveBeenCalledWith({
      where: { id: 'user-1' }
    });
    expect(prismaMock.productEvent.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' }
    });
    expect(prismaMock.recommendationEvent.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      prismaMock.user.deleteMany.mock.invocationCallOrder[0]
    );
  });

  it('does not delete any account data when the current password is wrong', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: await hashPassword('StrongPassphrase123!')
    });
    const { deleteUserAccount } = await import('../authService.js');

    await expect(deleteUserAccount('user-1', 'WrongPassphrase123!')).rejects.toMatchObject({
      status: 403,
      message: 'Current password is incorrect.'
    });
    expect(prismaMock.recommendationEvent.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.user.deleteMany).not.toHaveBeenCalled();
  });
});
