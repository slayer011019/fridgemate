import { describe, expect, it, vi } from 'vitest';
import {
  assertIngredientTombstoneScrubAccess,
  parseIngredientTombstoneScrubOptions,
  resolveIngredientTombstoneScrubDatabaseUrl,
  runIngredientTombstoneScrub,
  toAggregateIngredientTombstoneScrubLog
} from '../scrubIngredientTombstones.js';

const DATABASE_URL = 'postgresql://operator:secret@db.production.test:5432/fridgemate';

function buildOptions(overrides = {}) {
  return {
    apply: false,
    databaseHost: 'db.production.test',
    batchSize: 500,
    maxUpdate: 5_000,
    maxRuntimeMs: 30_000,
    ...overrides
  };
}

describe('ingredient tombstone scrub operations safety', () => {
  it('defaults to dry-run and refuses the runtime application credential', () => {
    expect(parseIngredientTombstoneScrubOptions({ args: [], databaseUrl: DATABASE_URL })).toMatchObject({
      apply: false,
      databaseHost: 'db.production.test',
      batchSize: 500,
      maxUpdate: 5_000,
      maxRuntimeMs: 30_000
    });
    expect(() => resolveIngredientTombstoneScrubDatabaseUrl({ DATABASE_URL })).toThrow(
      /runtime DATABASE_URL is not accepted/u
    );
  });

  it('requires explicit apply and acknowledgement of the exact database host', () => {
    expect(() =>
      parseIngredientTombstoneScrubOptions({ args: ['--apply'], databaseUrl: DATABASE_URL })
    ).toThrow(/confirm-database-host=db\.production\.test/u);
    expect(() =>
      parseIngredientTombstoneScrubOptions({
        args: ['--apply', '--confirm-database-host=other.test'],
        databaseUrl: DATABASE_URL
      })
    ).toThrow(/exact target database/u);

    expect(parseIngredientTombstoneScrubOptions({
      args: ['--apply', '--confirm-database-host=DB.PRODUCTION.TEST'],
      databaseUrl: DATABASE_URL
    }).apply).toBe(true);
  });

  it('rejects unsupported and unbounded operation arguments', () => {
    expect(() =>
      parseIngredientTombstoneScrubOptions({ args: ['--apply=yes'], databaseUrl: DATABASE_URL })
    ).toThrow(/Unsupported argument/u);
    expect(() =>
      parseIngredientTombstoneScrubOptions({ args: ['--batch-size=1001'], databaseUrl: DATABASE_URL })
    ).toThrow(/between 1 and 1000/u);
    expect(() =>
      parseIngredientTombstoneScrubOptions({ args: ['--max-update=50001'], databaseUrl: DATABASE_URL })
    ).toThrow(/between 1 and 50000/u);
    expect(() =>
      parseIngredientTombstoneScrubOptions({ args: ['--max-runtime-ms=120001'], databaseUrl: DATABASE_URL })
    ).toThrow(/between 1000 and 120000/u);
  });

  it('fails closed without maintenance RLS access and the prepare migration', async () => {
    const prisma = {
      $queryRawUnsafe: vi.fn()
        .mockResolvedValueOnce([{ canBypassRls: false }])
        .mockResolvedValueOnce([{ nullablePayloadColumnCount: 9, hasValidatedActiveConstraint: true }])
    };
    await expect(assertIngredientTombstoneScrubAccess(prisma)).rejects.toThrow(/bypass forced tenant RLS/u);

    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ canBypassRls: true }])
      .mockResolvedValueOnce([{ nullablePayloadColumnCount: 8, hasValidatedActiveConstraint: true }]);
    await expect(assertIngredientTombstoneScrubAccess(prisma)).rejects.toThrow(/nullable Ingredient payload/u);
  });

  it('keeps dry-run read-only and caps its aggregate eligibility scan', async () => {
    const prisma = {
      $queryRawUnsafe: vi.fn().mockResolvedValue([{ eligibleCount: 5_001n }]),
      $executeRawUnsafe: vi.fn()
    };
    const result = await runIngredientTombstoneScrub({
      prisma,
      options: buildOptions(),
      clock: () => 0
    });

    expect(result).toMatchObject({
      mode: 'dry-run',
      eligibleCount: 5_000,
      hasMore: true,
      updatedTotal: 0
    });
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('"deletedAt" IS NOT NULL'), 5_001);
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('scrubs only business payload in separately committed bounded batches', async () => {
    const prisma = {
      $queryRawUnsafe: vi.fn().mockResolvedValue([{ eligibleCount: 0n }]),
      $executeRawUnsafe: vi.fn()
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1)
    };
    const result = await runIngredientTombstoneScrub({
      prisma,
      options: buildOptions({ apply: true, batchSize: 2, maxUpdate: 5 }),
      clock: () => 0
    });

    expect(result).toMatchObject({
      mode: 'apply',
      updatedTotal: 5,
      maxUpdateReached: true,
      mayHaveMore: false,
      remainingEligibleCount: 0
    });
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(3);
    expect(prisma.$executeRawUnsafe.mock.calls.map((call) => call.at(-1))).toEqual([2, 2, 1]);
    const updateSql = prisma.$executeRawUnsafe.mock.calls[0][0];
    for (const column of [
      'name', 'category', 'storageType', 'quantity', 'purchaseDate',
      'expiryDate', 'memo', 'consumed', 'createdAt'
    ]) {
      expect(updateSql).toContain(`"${column}" = NULL`);
    }
    const setClause = updateSql.slice(updateSql.indexOf('SET'), updateSql.indexOf('FROM candidates'));
    expect(setClause).not.toMatch(/"(?:id|clientId|userId|updatedAt|deletedAt)"\s*=/u);
  });

  it('does not report completion when locked eligible rows prevent progress', async () => {
    const prisma = {
      $queryRawUnsafe: vi.fn().mockResolvedValue([{ eligibleCount: 1n }]),
      $executeRawUnsafe: vi.fn().mockResolvedValue(0)
    };
    const result = await runIngredientTombstoneScrub({
      prisma,
      options: buildOptions({ apply: true, batchSize: 10 }),
      clock: () => 0
    });

    expect(result).toMatchObject({
      updatedTotal: 0,
      mayHaveMore: true,
      remainingEligibleCount: 1
    });
  });

  it('emits aggregate-only logs without record identifiers or payload', () => {
    const log = toAggregateIngredientTombstoneScrubLog({
      mode: 'apply',
      policy: { batchSize: 1, maxUpdate: 1, maxRuntimeMs: 1_000 },
      updatedTotal: 1,
      remainingEligibleCount: 0
    }, 'db.production.test');

    expect(log).toMatchObject({ operation: 'ingredient_tombstone_scrub', updatedTotal: 1 });
    expect(JSON.stringify(log)).not.toMatch(/ingredientId|clientId|userId|name|memo|quantity/u);
  });
});
