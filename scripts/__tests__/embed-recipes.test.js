import { describe, expect, it, vi } from 'vitest';
import { embedRecipes, parseArgs } from '../embed-recipes.js';

describe('embed-recipes script', () => {
  it('supports dry-run without calling OpenAI or writing embeddings', async () => {
    const prismaClient = {
      $queryRawUnsafe: vi
        .fn()
        .mockResolvedValueOnce([
          {
            id: '11111111-1111-1111-1111-111111111111',
            name: 'Kimchi Fried Rice',
            dish_type: 'Rice',
            cooking_method: 'Stir-fry',
            ingredients_text: 'kimchi, rice',
            steps: [],
            raw: {}
          }
        ])
        .mockResolvedValueOnce([
          {
            recipe_id: '11111111-1111-1111-1111-111111111111',
            normalized_name: 'kimchi',
            canonical_name: 'kimchi',
            category: 'vegetable',
            raw_name: 'kimchi'
          }
        ])
        .mockResolvedValueOnce([]),
      $executeRawUnsafe: vi.fn(),
      $disconnect: vi.fn()
    };
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const summary = await embedRecipes({
      dryRun: true,
      limit: 1,
      batchSize: 1,
      prismaClient
    });

    expect(summary).toEqual({
      processed: 1,
      generated: 0,
      skipped: 1,
      failed: 0,
      current: 0,
      missing: 1,
      stale: 0,
      writeLimitReached: false,
      lastProcessedRecipeId: '11111111-1111-1111-1111-111111111111'
    });
    expect(prismaClient.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Summary: processed=1'));

    consoleSpy.mockRestore();
  });

  it('stops after the configured maximum number of successful writes', async () => {
    const recipes = Array.from({ length: 3 }, (_, index) => ({
      id: `00000000-0000-4000-8000-00000000000${index}`,
      name: `Recipe ${index}`,
      dish_type: 'Rice',
      cooking_method: 'Boil',
      ingredients_text: '',
      steps: [],
      raw: {}
    }));
    const prismaClient = {
      $queryRawUnsafe: vi.fn().mockResolvedValueOnce(recipes).mockResolvedValueOnce([]).mockResolvedValueOnce([]),
      $disconnect: vi.fn()
    };
    const createEmbedding = vi.fn(async () => [0.1, 0.2, 0.3]);
    const upsertEmbedding = vi.fn(async () => {});
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const summary = await embedRecipes({
      dryRun: false,
      backfillMissing: true,
      backfillStale: false,
      limit: 3,
      batchSize: 3,
      maxWrites: 2,
      prismaClient,
      embeddingConfig: { apiKey: 'test-key', model: 'test-model', dimensions: 3 },
      createEmbedding,
      upsertEmbedding
    });

    expect(summary).toMatchObject({
      processed: 2,
      generated: 2,
      failed: 0,
      missing: 2,
      writeLimitReached: true
    });
    expect(createEmbedding).toHaveBeenCalledTimes(2);
    expect(upsertEmbedding).toHaveBeenCalledTimes(2);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('writeLimitReached=true'));

    consoleSpy.mockRestore();
  });

  it('parses an explicit write cap independently from the scan limit', () => {
    expect(parseArgs(['--backfill-missing', '--limit=1146', '--max-writes=10'])).toMatchObject({
      dryRun: false,
      backfillMissing: true,
      limit: 1146,
      maxWrites: 10
    });
  });
});
