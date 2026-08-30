import { describe, expect, it, vi } from 'vitest';
import {
  PRODUCT_EVENT_RETENTION_DAYS,
  RECOMMENDATION_EVENT_RETENTION_DAYS,
  assertEventRetentionMaintenanceAccess,
  getEventRetentionCutoffs,
  parseEventRetentionOptions,
  resolveEventRetentionDatabaseUrl,
  runEventRetention,
  toAggregateRetentionLog
} from '../pruneEventRetention.js';

const DATABASE_URL = 'postgresql://operator:secret@db.production.test:5432/fridgemate';

function buildOptions(overrides = {}) {
  return {
    apply: false,
    databaseHost: 'db.production.test',
    batchSize: 500,
    maxDelete: 5_000,
    maxRuntimeMs: 30_000,
    ...overrides
  };
}

describe('event retention operations safety', () => {
  it('uses fixed server-created-time retention periods', () => {
    const now = new Date('2026-08-30T12:00:00.000Z');
    const cutoffs = getEventRetentionCutoffs(now);

    expect(PRODUCT_EVENT_RETENTION_DAYS).toBe(90);
    expect(RECOMMENDATION_EVENT_RETENTION_DAYS).toBe(180);
    expect(cutoffs.productEvents.toISOString()).toBe('2026-06-01T12:00:00.000Z');
    expect(cutoffs.recommendationEvents.toISOString()).toBe('2026-03-03T12:00:00.000Z');
  });

  it('defaults to dry-run and refuses the runtime database credential fallback', () => {
    expect(parseEventRetentionOptions({ args: [], databaseUrl: DATABASE_URL })).toMatchObject({
      apply: false,
      databaseHost: 'db.production.test',
      batchSize: 500,
      maxDelete: 5_000,
      maxRuntimeMs: 30_000
    });
    expect(() => resolveEventRetentionDatabaseUrl({ DATABASE_URL })).toThrow(
      /runtime DATABASE_URL is not accepted/u
    );
  });

  it('requires explicit apply and the exact production database hostname', () => {
    expect(() =>
      parseEventRetentionOptions({ args: ['--apply'], databaseUrl: DATABASE_URL })
    ).toThrow(/confirm-database-host=db\.production\.test/u);
    expect(() =>
      parseEventRetentionOptions({
        args: ['--apply', '--confirm-database-host=other.test'],
        databaseUrl: DATABASE_URL
      })
    ).toThrow(/exact target database/u);

    expect(
      parseEventRetentionOptions({
        args: ['--apply', '--confirm-database-host=DB.PRODUCTION.TEST'],
        databaseUrl: DATABASE_URL
      }).apply
    ).toBe(true);
  });

  it('fails closed when the maintenance role cannot bypass forced tenant RLS', async () => {
    await expect(
      assertEventRetentionMaintenanceAccess({
        $queryRawUnsafe: vi.fn().mockResolvedValue([{ canBypassRls: false }])
      })
    ).rejects.toThrow(/bypass forced tenant RLS/u);

    await expect(
      assertEventRetentionMaintenanceAccess({
        $queryRawUnsafe: vi.fn().mockResolvedValue([{ canBypassRls: true }])
      })
    ).resolves.toBeUndefined();
  });

  it('rejects unsupported or unbounded operation arguments', () => {
    expect(() =>
      parseEventRetentionOptions({ args: ['--apply=yes'], databaseUrl: DATABASE_URL })
    ).toThrow(/Unsupported argument/u);
    expect(() =>
      parseEventRetentionOptions({ args: ['--batch-size=1001'], databaseUrl: DATABASE_URL })
    ).toThrow(/between 1 and 1000/u);
    expect(() =>
      parseEventRetentionOptions({ args: ['--max-delete=50001'], databaseUrl: DATABASE_URL })
    ).toThrow(/between 1 and 50000/u);
    expect(() =>
      parseEventRetentionOptions({ args: ['--max-runtime-ms=120001'], databaseUrl: DATABASE_URL })
    ).toThrow(/between 1000 and 120000/u);
  });

  it('keeps previews read-only and caps every aggregate eligibility scan', async () => {
    const prisma = {
      $queryRawUnsafe: vi.fn().mockResolvedValue([{ eligibleCount: 5_001n }]),
      $executeRawUnsafe: vi.fn()
    };

    const result = await runEventRetention({
      prisma,
      options: buildOptions(),
      now: new Date('2026-08-30T12:00:00.000Z')
    });

    expect(result.mode).toBe('dry-run');
    expect(result.deletedTotal).toBe(0);
    expect(result.targets).toHaveLength(3);
    expect(result.targets.every((target) => target.eligibleCount === 5_000 && target.hasMore)).toBe(true);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(3);
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();

    const productCall = prisma.$queryRawUnsafe.mock.calls.find(([sql]) => sql.includes('"ProductEvent"'));
    expect(productCall[0]).toContain('"createdAt" < $1');
    expect(productCall[0]).not.toContain('"occurredAt"');
    expect(productCall.at(-1)).toBe(5_001);

    const ownerlessCall = prisma.$queryRawUnsafe.mock.calls.find(([sql]) => sql.includes('"userId" IS NULL'));
    expect(ownerlessCall).toBeDefined();
  });

  it('round-robins bounded batches and never exceeds the global deletion cap', async () => {
    const prisma = {
      $queryRawUnsafe: vi.fn(),
      $executeRawUnsafe: vi.fn(async (_sql, ...parameters) => parameters.at(-1))
    };

    const result = await runEventRetention({
      prisma,
      options: buildOptions({ apply: true, batchSize: 2, maxDelete: 5 }),
      now: new Date('2026-08-30T12:00:00.000Z'),
      clock: () => 0
    });

    expect(result).toMatchObject({
      mode: 'apply',
      deletedTotal: 5,
      maxDeleteReached: true,
      runtimeLimitReached: false
    });
    expect(result.targets.map((target) => target.deletedCount)).toEqual([2, 2, 1]);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(3);
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('stops before another batch when the runtime budget is exhausted', async () => {
    const prisma = {
      $queryRawUnsafe: vi.fn(),
      $executeRawUnsafe: vi.fn().mockResolvedValue(1)
    };
    const clock = vi.fn()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValue(1_000);

    const result = await runEventRetention({
      prisma,
      options: buildOptions({ apply: true, batchSize: 2, maxDelete: 10, maxRuntimeMs: 1_000 }),
      now: new Date('2026-08-30T12:00:00.000Z'),
      clock
    });

    expect(result.deletedTotal).toBe(1);
    expect(result.runtimeLimitReached).toBe(true);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
  });

  it('also applies the runtime budget to dry-run aggregate scans', async () => {
    const prisma = {
      $queryRawUnsafe: vi.fn().mockResolvedValue([{ eligibleCount: 1n }]),
      $executeRawUnsafe: vi.fn()
    };
    const clock = vi.fn()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValue(1_000);

    const result = await runEventRetention({
      prisma,
      options: buildOptions({ maxRuntimeMs: 1_000 }),
      now: new Date('2026-08-30T12:00:00.000Z'),
      clock
    });

    expect(result.targets).toHaveLength(1);
    expect(result.runtimeLimitReached).toBe(true);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('formats only policy and aggregate operation results', () => {
    const log = toAggregateRetentionLog(
      {
        mode: 'apply',
        policy: { batchSize: 1, maxDelete: 1, maxRuntimeMs: 1_000 },
        deletedTotal: 1,
        targets: [{ key: 'productEvents', retentionDays: 90, deletedCount: 1 }]
      },
      'db.production.test'
    );

    expect(log.targets).toEqual([
      {
        key: 'productEvents',
        retentionDays: 90,
        cutoff: undefined,
        eligibleCount: undefined,
        deletedCount: 1,
        hasMore: undefined,
        mayHaveMore: undefined
      }
    ]);
    expect(JSON.stringify(log)).not.toMatch(/userId|clientEventId|properties|sessionId/u);
  });
});
