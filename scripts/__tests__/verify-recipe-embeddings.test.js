import { describe, expect, it, vi } from 'vitest';
import {
  parseVerificationArgs,
  verifyRecipeEmbeddings
} from '../verify-recipe-embeddings.js';

function createPrismaClient(overrides = {}) {
  const transaction = {
    $executeRawUnsafe: vi.fn(),
    $queryRawUnsafe: vi
      .fn()
      .mockResolvedValueOnce([
        {
          recipe_count: 3,
          embedding_count: 3,
          duplicate_count: 0,
          orphan_count: 0,
          embedding_type: 'vector(1536)'
        }
      ])
      .mockResolvedValueOnce([
        {
          embedding_model: 'text-embedding-3-small',
          embedding_dimensions: 1536,
          count: 3
        }
      ]),
    ...overrides
  };
  return {
    transaction,
    prismaClient: {
      $transaction: vi.fn(async (operation) => operation(transaction)),
      $disconnect: vi.fn()
    }
  };
}

describe('recipe embedding production verifier', () => {
  it('defaults to the live catalog count instead of a hardcoded limit', () => {
    expect(parseVerificationArgs([])).toEqual({
      limit: null,
      batchSize: 100,
      expected: {}
    });
  });

  it('parses staged expected counts', () => {
    expect(
      parseVerificationArgs([
        '--limit=1146',
        '--batch-size=50',
        '--expect-recipes=1146',
        '--expect-embeddings=1028',
        '--expect-current=45',
        '--expect-missing=118',
        '--expect-stale=983'
      ])
    ).toEqual({
      limit: 1146,
      batchSize: 50,
      expected: {
        recipes: 1146,
        embeddings: 1028,
        current: 45,
        missing: 118,
        stale: 983
      }
    });
  });

  it('passes a read-only complete integrity snapshot', async () => {
    const { prismaClient, transaction } = createPrismaClient();
    const scanEmbeddings = vi.fn(async () => ({
      processed: 3,
      current: 3,
      missing: 0,
      stale: 0,
      apiRequestCount: 0
    }));

    const result = await verifyRecipeEmbeddings({
      limit: 3,
      expected: { recipes: 3, embeddings: 3, current: 3, missing: 0, stale: 0 },
      prismaClient,
      scanEmbeddings,
      embeddingConfig: { model: 'text-embedding-3-small', dimensions: 1536 }
    });

    expect(result).toMatchObject({
      passed: true,
      recipes: 3,
      embeddings: 3,
      current: 3,
      missing: 0,
      stale: 0,
      duplicateKeys: 0,
      orphanEmbeddings: 0,
      embeddingType: 'vector(1536)',
      apiRequestCount: 0,
      productionWrites: 0,
      failures: []
    });
    expect(transaction.$executeRawUnsafe).toHaveBeenCalledWith('SET TRANSACTION READ ONLY');
  });

  it('fails when staged expectations or integrity checks differ', async () => {
    const { prismaClient } = createPrismaClient({
      $executeRawUnsafe: vi.fn(),
      $queryRawUnsafe: vi
        .fn()
        .mockResolvedValueOnce([
          {
            recipe_count: 3,
            embedding_count: 2,
            duplicate_count: 1,
            orphan_count: 0,
            embedding_type: 'vector(1536)'
          }
        ])
        .mockResolvedValueOnce([
          {
            embedding_model: 'text-embedding-3-small',
            embedding_dimensions: 1536,
            count: 2
          }
        ])
    });
    const scanEmbeddings = vi.fn(async () => ({
      processed: 3,
      current: 2,
      missing: 1,
      stale: 0,
      apiRequestCount: 0
    }));

    const result = await verifyRecipeEmbeddings({
      limit: 3,
      expected: { embeddings: 3, current: 3 },
      prismaClient,
      scanEmbeddings,
      embeddingConfig: { model: 'text-embedding-3-small', dimensions: 1536 }
    });

    expect(result.passed).toBe(false);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        'duplicate keys: 1',
        'embeddings: expected 3, received 2',
        'current: expected 3, received 2'
      ])
    );
  });
});
