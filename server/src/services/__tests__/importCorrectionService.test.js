import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMocks = vi.hoisted(() => ({
  createEmbedding: vi.fn(),
  isEmbeddingEnabled: vi.fn(),
  upsert: vi.fn(),
  withUserDatabaseScope: vi.fn()
}));

vi.mock('../../db/tenantScope.js', () => ({
  withUserDatabaseScope: serviceMocks.withUserDatabaseScope
}));

vi.mock('../embeddingService.js', () => ({
  createEmbedding: serviceMocks.createEmbedding,
  isEmbeddingEnabled: serviceMocks.isEmbeddingEnabled,
  toVectorLiteral: vi.fn()
}));

import { serverConfig } from '../../config.js';
import {
  buildSafeImportCorrectionEmbeddingText,
  getImportCorrectionSuggestions,
  saveImportCorrectionsForUser
} from '../importCorrectionService.js';

const originalLearningFlag = serverConfig.importCorrectionLearningEnabled;
const originalEmbeddingFlag = serverConfig.importCorrectionEmbeddingEnabled;

const SAFE_ITEM = {
  id: 'receipt-1',
  normalizedName: '우유',
  correctedName: '서울우유',
  category: '유제품',
  storageType: '냉장'
};

describe('importCorrectionService privacy boundary', () => {
  beforeEach(() => {
    serviceMocks.createEmbedding.mockReset();
    serviceMocks.isEmbeddingEnabled.mockReset().mockReturnValue(false);
    serviceMocks.upsert.mockReset().mockResolvedValue({});
    serviceMocks.withUserDatabaseScope.mockReset().mockImplementation((_userId, operation) =>
      operation({ importCorrection: { upsert: serviceMocks.upsert } })
    );
    serverConfig.importCorrectionLearningEnabled = true;
    serverConfig.importCorrectionEmbeddingEnabled = false;
  });

  afterEach(() => {
    serverConfig.importCorrectionLearningEnabled = originalLearningFlag;
    serverConfig.importCorrectionEmbeddingEnabled = originalEmbeddingFlag;
  });

  it('fails closed without inspecting or storing input while learning is disabled', async () => {
    serverConfig.importCorrectionLearningEnabled = false;
    const rawItem = { id: 'receipt-1', sourceLine: 'victim@example.com' };

    await expect(getImportCorrectionSuggestions('user-1', [rawItem])).resolves.toEqual({});
    await expect(saveImportCorrectionsForUser('user-1', [rawItem])).resolves.toEqual({ savedCount: 0 });
    expect(serviceMocks.withUserDatabaseScope).not.toHaveBeenCalled();
    expect(serviceMocks.createEmbedding).not.toHaveBeenCalled();
  });

  it.each(['sourceLine', 'rawLine', 'originalText', 'specText', 'quantity'])(
    'rejects raw receipt field %s when learning is enabled',
    async (field) => {
      await expect(
        getImportCorrectionSuggestions('user-1', [{ ...SAFE_ITEM, [field]: 'private receipt data' }])
      ).rejects.toMatchObject({ status: 400 });
    }
  );

  it.each([
    'victim@example.com',
    '010-1234-5678',
    '900101-1234567',
    '4111 1111 1111 1111',
    'https://private.example/order/123',
    '서울특별시 중구 세종대로 110'
  ])('rejects likely personal data in allowlisted fields: %s', async (value) => {
    await expect(
      getImportCorrectionSuggestions('user-1', [{ ...SAFE_ITEM, normalizedName: value }])
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects oversized batches instead of silently truncating them', async () => {
    const items = Array.from({ length: 31 }, (_value, index) => ({
      ...SAFE_ITEM,
      id: `receipt-${index}`
    }));

    await expect(getImportCorrectionSuggestions('user-1', items)).rejects.toMatchObject({
      status: 400
    });
  });

  it('stores only the bounded correction DTO and does not call embeddings unless separately enabled', async () => {
    await expect(saveImportCorrectionsForUser('user-1', [SAFE_ITEM])).resolves.toEqual({
      savedCount: 1
    });

    expect(serviceMocks.createEmbedding).not.toHaveBeenCalled();
    expect(serviceMocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sourceText: '우유',
          correctedName: '서울우유',
          category: '유제품',
          storageType: '냉장'
        })
      })
    );
  });

  it('rebuilds backfill embedding text only from bounded, privacy-checked fields', () => {
    expect(
      buildSafeImportCorrectionEmbeddingText({
        sourceText: '우유',
        correctedName: '서울우유',
        category: '유제품',
        storageType: '냉장',
        embeddingText: 'legacy raw receipt victim@example.com'
      })
    ).toBe('우유 | 서울우유 | 유제품 | 냉장');

    expect(() =>
      buildSafeImportCorrectionEmbeddingText({
        sourceText: '010-1234-5678',
        correctedName: '우유',
        category: '유제품',
        storageType: '냉장'
      })
    ).toThrow(/personal or receipt-level data/u);
  });
});
