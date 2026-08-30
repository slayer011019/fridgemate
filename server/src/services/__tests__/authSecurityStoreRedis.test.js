import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redisClient = vi.hoisted(() => ({
  isOpen: false,
  connect: vi.fn(),
  del: vi.fn(),
  get: vi.fn(),
  incrBy: vi.fn(),
  keys: vi.fn(),
  on: vi.fn(),
  pExpire: vi.fn(),
  pTTL: vi.fn(),
  quit: vi.fn(),
  set: vi.fn()
}));

const createClient = vi.hoisted(() => vi.fn(() => redisClient));

vi.mock('redis', () => ({ createClient }));

const REDIS_PREFIX = 'fridgemate:test-auth';

function resetRedisClient() {
  redisClient.isOpen = false;

  for (const mock of Object.values(redisClient)) {
    if (typeof mock?.mockReset === 'function') {
      mock.mockReset();
    }
  }

  redisClient.on.mockReturnValue(redisClient);
  redisClient.connect.mockImplementation(async () => {
    redisClient.isOpen = true;
  });
  redisClient.quit.mockImplementation(async () => {
    redisClient.isOpen = false;
  });
  redisClient.del.mockResolvedValue(0);
  redisClient.keys.mockResolvedValue([]);
  redisClient.pExpire.mockResolvedValue(true);
  redisClient.set.mockResolvedValue('OK');
}

describe('Redis auth security store privacy and TTL recovery', () => {
  beforeEach(() => {
    vi.resetModules();
    resetRedisClient();
    process.env.JWT_SECRET = '12345678901234567890123456789012';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/fridgemate';
    process.env.NODE_ENV = 'test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.AUTH_REDIS_PREFIX = REDIS_PREFIX;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    const authSecurityStore = await import('../authSecurityStore.js');
    await authSecurityStore.shutdownAuthSecurityStore();
    delete process.env.REDIS_URL;
    delete process.env.AUTH_REDIS_PREFIX;
  });

  it('uses an opaque rate-limit suffix and restores a missing expiration', async () => {
    redisClient.incrBy.mockResolvedValue(1);
    redisClient.pTTL.mockResolvedValue(-1);
    const authSecurityStore = await import('../authSecurityStore.js');

    await authSecurityStore.initializeAuthSecurityStore();
    await authSecurityStore.consumeAuthRateLimit({
      scope: 'login-email',
      key: 'person@example.com',
      limit: 5,
      windowMs: 60_000
    });
    await authSecurityStore.consumeAuthRateLimit({
      scope: 'recommendation-events',
      key: 'client:203.0.113.10',
      limit: 120,
      windowMs: 60_000
    });

    const redisKeys = redisClient.incrBy.mock.calls.map(([redisKey]) => redisKey);
    expect(redisKeys).toHaveLength(2);
    for (const redisKey of redisKeys) {
      expect(redisKey).toMatch(new RegExp(`^${REDIS_PREFIX}:ratelimit:[a-f0-9]{64}$`));
      expect(redisKey).not.toContain('person@example.com');
      expect(redisKey).not.toContain('203.0.113.10');
      expect(redisClient.pExpire).toHaveBeenCalledWith(redisKey, 60_000);
    }
    expect(redisClient.del).not.toHaveBeenCalled();
  });

  it('stores token revocation under an opaque key and repairs its missing TTL', async () => {
    const nowSeconds = 1_700_000_000;
    const expiresAt = nowSeconds + 3_600;
    vi.spyOn(Date, 'now').mockReturnValue(nowSeconds * 1000);
    const authSecurityStore = await import('../authSecurityStore.js');

    await authSecurityStore.initializeAuthSecurityStore();
    await authSecurityStore.revokeAuthToken('private-jti', expiresAt);

    const redisKey = redisClient.set.mock.calls[0][0];
    expect(redisKey).toMatch(new RegExp(`^${REDIS_PREFIX}:revoked:[a-f0-9]{64}$`));
    expect(redisKey).not.toContain('private-jti');
    expect(redisClient.set).toHaveBeenCalledWith(redisKey, String(expiresAt), { EX: 3_600 });
    expect(redisClient.del).not.toHaveBeenCalled();

    redisClient.get.mockResolvedValue(String(expiresAt));
    redisClient.pTTL.mockResolvedValue(-1);
    redisClient.pExpire.mockClear();

    await expect(
      authSecurityStore.checkRevokedToken('private-jti', expiresAt)
    ).resolves.toBe(true);
    expect(redisClient.pExpire).toHaveBeenCalledWith(redisKey, 3_600_000);
  });

  it('never probes a legacy raw revocation key when the opaque key is absent', async () => {
    const nowSeconds = 1_700_000_000;
    const expiresAt = nowSeconds + 900;
    vi.spyOn(Date, 'now').mockReturnValue(nowSeconds * 1000);
    redisClient.get.mockResolvedValue(null);
    const authSecurityStore = await import('../authSecurityStore.js');

    await authSecurityStore.initializeAuthSecurityStore();
    await expect(
      authSecurityStore.checkRevokedToken('legacy-private-jti', expiresAt)
    ).resolves.toBe(false);

    const opaqueRedisKey = redisClient.get.mock.calls[0][0];
    expect(opaqueRedisKey).toMatch(new RegExp(`^${REDIS_PREFIX}:revoked:[a-f0-9]{64}$`));
    expect(opaqueRedisKey).not.toContain('legacy-private-jti');
    expect(redisClient.get).toHaveBeenCalledTimes(1);
    expect(redisClient.pTTL).not.toHaveBeenCalled();
    expect(redisClient.set).not.toHaveBeenCalled();
    expect(redisClient.del).not.toHaveBeenCalled();
  });
});
