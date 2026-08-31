import { describe, expect, it, vi } from 'vitest';
import {
  assertBackfillSafety,
  runImportCorrectionEmbeddingBackfill
} from '../backfillImportCorrectionEmbeddings.js';

const DATABASE_URL = 'postgresql://user:password@db.example.test:5432/fridgemate';
const ENABLED_CONFIG = {
  importCorrectionLearningEnabled: true,
  importCorrectionEmbeddingEnabled: true,
  embeddingModel: 'text-embedding-3-small',
  embeddingDimensions: 512
};

function createPrismaMock(rows = []) {
  return {
    $queryRaw: vi.fn().mockResolvedValue(rows),
    $executeRaw: vi.fn().mockResolvedValue(1)
  };
}

describe('import correction embedding backfill safety', () => {
  it.each([
    { importCorrectionLearningEnabled: false, importCorrectionEmbeddingEnabled: true },
    { importCorrectionLearningEnabled: true, importCorrectionEmbeddingEnabled: false }
  ])('fails closed when either feature flag is disabled', (flags) => {
    const prisma = createPrismaMock();
    const createEmbedding = vi.fn();

    expect(() =>
      assertBackfillSafety({
        args: ['--execute', '--confirm-database-host=db.example.test'],
        databaseUrl: DATABASE_URL,
        serverConfig: { ...ENABLED_CONFIG, ...flags },
        isEmbeddingEnabled: () => true
      })
    ).toThrow(/must be explicitly set to true/u);

    expect(createEmbedding).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('allows dry-run inspection but rejects bulk execution without per-record consent evidence', () => {
    expect(
      assertBackfillSafety({
        args: [],
        databaseUrl: DATABASE_URL,
        serverConfig: ENABLED_CONFIG,
        isEmbeddingEnabled: () => false
      })
    ).toEqual({ databaseHost: 'db.example.test', execute: false });

    expect(() =>
      assertBackfillSafety({
        args: ['--execute', '--confirm-database-host=db.example.test'],
        databaseUrl: DATABASE_URL,
        serverConfig: ENABLED_CONFIG,
        isEmbeddingEnabled: () => true
      })
    ).toThrow(/per-record external AI consent evidence/u);
  });

  it('keeps dry runs and rejected legacy rows away from OpenAI and database writes', async () => {
    const prisma = createPrismaMock([
      {
        id: 'safe',
        sourceText: '우유',
        correctedName: '서울우유',
        category: '유제품',
        storageType: '냉장'
      },
      {
        id: 'private',
        sourceText: '010-1234-5678',
        correctedName: '우유',
        category: '유제품',
        storageType: '냉장'
      }
    ]);
    const createEmbedding = vi.fn();
    const buildSafeEmbeddingText = vi.fn((correction) => {
      if (correction.id === 'private') throw new Error('private');
      return '우유 | 서울우유 | 유제품 | 냉장';
    });

    await expect(
      runImportCorrectionEmbeddingBackfill({
        buildSafeEmbeddingText,
        createEmbedding,
        execute: false,
        prisma,
        serverConfig: ENABLED_CONFIG,
        toVectorLiteral: vi.fn()
      })
    ).resolves.toMatchObject({
      scannedCount: 2,
      eligibleCount: 1,
      rejectedCount: 1,
      updatedCount: 0,
      dryRun: true
    });

    expect(createEmbedding).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('rejects direct execution attempts before reading rows or making an external call', async () => {
    const prisma = createPrismaMock([
      {
        id: 'private',
        sourceText: 'victim@example.com',
        correctedName: '우유',
        category: '유제품',
        storageType: '냉장'
      }
    ]);
    const createEmbedding = vi.fn();

    await expect(
      runImportCorrectionEmbeddingBackfill({
        buildSafeEmbeddingText: () => {
          throw new Error('private');
        },
        createEmbedding,
        execute: true,
        prisma,
        serverConfig: ENABLED_CONFIG,
        toVectorLiteral: vi.fn()
      })
    ).rejects.toThrow(/per-record external AI consent evidence/u);

    expect(createEmbedding).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});
