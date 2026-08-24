import { scryptSync } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  },
  authSession: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.JWT_SECRET = '12345678901234567890123456789012';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/fridgemate';
    process.env.JWT_ISSUER = 'fridgemate-api';
    process.env.JWT_AUDIENCE = 'fridgemate-client';
    process.env.NODE_ENV = 'test';
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

  it('rejects a refresh request without a cookie before querying the database', async () => {
    const { refreshUserSession } = await import('../authService.js');

    await expect(refreshUserSession()).rejects.toMatchObject({
      status: 401,
      message: 'The current session is no longer valid.'
    });
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
    prismaMock.authSession.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.authSession.create.mockResolvedValue({ id: 'session-2' });
    prismaMock.authSession.update.mockResolvedValue(null);
    const { refreshUserSession } = await import('../authService.js');

    const result = await refreshUserSession('valid-refresh-token');

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

  it('rejects refresh-token reuse and revokes the user refresh sessions', async () => {
    prismaMock.authSession.findUnique.mockResolvedValue({
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
    });
    prismaMock.authSession.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    const { refreshUserSession } = await import('../authService.js');

    await expect(refreshUserSession('reused-refresh-token')).rejects.toMatchObject({
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
});
