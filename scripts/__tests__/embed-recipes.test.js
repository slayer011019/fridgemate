import { describe, expect, it, vi } from 'vitest';
import { createEmbeddingBatch, embedRecipes, parseArgs } from '../embed-recipes.js';

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

    expect(summary).toMatchObject({
      processed: 1,
      generated: 0,
      skipped: 1,
      failed: 0,
      current: 0,
      missing: 1,
      stale: 0,
      plannedInputs: 1,
      apiInputCount: 0,
      apiRequestCount: 0,
      writeLimitReached: false,
      lastProcessedRecipeId: '11111111-1111-1111-1111-111111111111',
      lastSuccessfulRecipeId: '11111111-1111-1111-1111-111111111111'
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
    const createEmbeddings = vi.fn(async (texts) => ({
      vectors: texts.map(() => [0.1, 0.2, 0.3]),
      requestCount: 1,
      retryCount: 0
    }));
    const upsertEmbedding = vi.fn(async () => {});
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const summary = await embedRecipes({
      dryRun: false,
      backfillMissing: true,
      backfillStale: false,
      limit: 3,
      batchSize: 3,
      maxWrites: 2,
      apiBatchSize: 25,
      persistState: false,
      prismaClient,
      embeddingConfig: { apiKey: 'test-key', model: 'test-model', dimensions: 3 },
      createEmbeddings,
      upsertEmbedding
    });

    expect(summary).toMatchObject({
      processed: 2,
      generated: 2,
      failed: 0,
      missing: 2,
      apiInputCount: 2,
      apiRequestCount: 1,
      writeLimitReached: true
    });
    expect(createEmbeddings).toHaveBeenCalledTimes(1);
    expect(createEmbeddings.mock.calls[0][0]).toHaveLength(2);
    expect(upsertEmbedding).toHaveBeenCalledTimes(2);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('writeLimitReached=true'));

    consoleSpy.mockRestore();
  });

  it('parses an explicit write cap independently from the scan limit', () => {
    expect(
      parseArgs([
        '--backfill-missing',
        '--limit=1146',
        '--max-writes=10',
        '--api-batch-size=50',
        '--max-retries=5',
        '--resume',
        '--state-file=.local/custom-state.json'
      ])
    ).toMatchObject({
      dryRun: false,
      backfillMissing: true,
      limit: 1146,
      maxWrites: 10,
      apiBatchSize: 50,
      maxRetries: 5,
      resume: true,
      stateFile: '.local/custom-state.json'
    });
  });

  it('parses stored-vector evaluation without enabling a backfill', () => {
    expect(parseArgs(['--evaluate', '--execute', '--stored-vectors', '--limit=1146'])).toMatchObject({
      dryRun: true,
      evaluate: true,
      executeEvaluation: true,
      storedVectors: true,
      backfillMissing: false,
      backfillStale: false,
      limit: 1146
    });
  });

  it('retries 429 and 5xx responses with exponential delays and one multi-input payload', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, headers: { get: () => null } })
      .mockResolvedValueOnce({ ok: false, status: 503, headers: { get: () => null } })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { index: 0, embedding: [1, 0, 0] },
            { index: 1, embedding: [0, 1, 0] }
          ]
        })
      });
    const sleep = vi.fn(async () => {});

    const result = await createEmbeddingBatch(
      ['first recipe', 'second recipe'],
      { apiKey: 'test-key', model: 'test-model', dimensions: 3 },
      { fetchImpl, sleep, maxRetries: 2, retryBaseMs: 100, retryMaxMs: 1000 }
    );

    expect(result).toEqual({
      vectors: [[1, 0, 0], [0, 1, 0]],
      requestCount: 3,
      retryCount: 2
    });
    expect(sleep).toHaveBeenNthCalledWith(1, 100);
    expect(sleep).toHaveBeenNthCalledWith(2, 200);
    const requestBody = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(requestBody.input).toEqual(['first recipe', 'second recipe']);
  });

  it('does not retry a non-retryable 4xx response', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 400, headers: { get: () => null } }));
    const sleep = vi.fn(async () => {});

    await expect(
      createEmbeddingBatch(
        ['recipe'],
        { apiKey: 'test-key', model: 'test-model', dimensions: 3 },
        { fetchImpl, sleep, maxRetries: 4 }
      )
    ).rejects.toThrow('status 400');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('resumes with keyset pagination and persists the last successful recipe', async () => {
    const resumedAfter = '11111111-1111-4111-8111-111111111111';
    const nextId = '22222222-2222-4222-8222-222222222222';
    const prismaClient = {
      $queryRawUnsafe: vi
        .fn()
        .mockResolvedValueOnce([{ id: nextId, name: 'Next recipe', dish_type: 'Rice' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
      $disconnect: vi.fn()
    };
    const loadState = vi.fn(async () => ({
      version: 1,
      operation: 'missing',
      model: 'test-model',
      dimensions: 3,
      lastSuccessfulRecipeId: resumedAfter
    }));
    const saveState = vi.fn(async () => {});

    const summary = await embedRecipes({
      dryRun: false,
      backfillMissing: true,
      limit: 1,
      batchSize: 1,
      maxWrites: 1,
      resume: true,
      stateFile: '.local/test-state.json',
      prismaClient,
      embeddingConfig: { apiKey: 'test-key', model: 'test-model', dimensions: 3 },
      createEmbeddings: vi.fn(async () => ({ vectors: [[1, 0, 0]], requestCount: 1, retryCount: 0 })),
      upsertEmbedding: vi.fn(async () => {}),
      loadState,
      saveState
    });

    expect(summary).toMatchObject({ resumed: true, generated: 1, lastSuccessfulRecipeId: nextId });
    expect(prismaClient.$queryRawUnsafe.mock.calls[0][0]).not.toContain('OFFSET');
    expect(prismaClient.$queryRawUnsafe.mock.calls[0][1]).toBe(resumedAfter);
    expect(saveState).toHaveBeenCalledWith(
      '.local/test-state.json',
      expect.objectContaining({ status: 'paused', lastSuccessfulRecipeId: nextId })
    );
  });

  it('uses the last safe UUID for every batch without offset pagination gaps', async () => {
    const ids = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333'
    ];
    const prismaClient = {
      $queryRawUnsafe: vi
        .fn()
        .mockResolvedValueOnce(ids.slice(0, 2).map((id) => ({ id, name: id, dish_type: 'Rice' })))
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: ids[2], name: ids[2], dish_type: 'Rice' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
      $disconnect: vi.fn()
    };
    const createEmbeddings = vi.fn(async (texts) => ({
      vectors: texts.map(() => [1, 0, 0]),
      requestCount: 1,
      retryCount: 0
    }));

    const summary = await embedRecipes({
      dryRun: false,
      backfillMissing: true,
      limit: 3,
      batchSize: 2,
      apiBatchSize: 2,
      persistState: false,
      prismaClient,
      embeddingConfig: { apiKey: 'test-key', model: 'test-model', dimensions: 3 },
      createEmbeddings,
      upsertEmbedding: vi.fn(async () => {})
    });

    expect(summary).toMatchObject({ processed: 3, generated: 3, apiRequestCount: 2 });
    expect(createEmbeddings.mock.calls.map(([texts]) => texts.length)).toEqual([2, 1]);
    const recipeQueries = prismaClient.$queryRawUnsafe.mock.calls.filter(([sql]) =>
      sql.includes('FROM recipes')
    );
    expect(recipeQueries).toHaveLength(2);
    expect(recipeQueries[0][0]).not.toContain('OFFSET');
    expect(recipeQueries[1][0]).not.toContain('OFFSET');
    expect(recipeQueries[1][1]).toBe(ids[1]);
  });

  it('keeps a retryable state when an embedding batch fails before the first write', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const prismaClient = {
      $queryRawUnsafe: vi
        .fn()
        .mockResolvedValueOnce([{ id, name: 'Recipe', dish_type: 'Rice' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
      $disconnect: vi.fn()
    };
    const requestError = new Error('Recipe embedding request failed with status 503.');
    requestError.requestCount = 3;
    requestError.retryCount = 2;
    const saveState = vi.fn(async () => {});
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const summary = await embedRecipes({
      dryRun: false,
      backfillMissing: true,
      limit: 1,
      batchSize: 1,
      persistState: true,
      stateFile: '.local/test-failed-state.json',
      prismaClient,
      embeddingConfig: { apiKey: 'test-key', model: 'test-model', dimensions: 3 },
      createEmbeddings: vi.fn(async () => {
        throw requestError;
      }),
      upsertEmbedding: vi.fn(async () => {}),
      saveState
    });

    expect(summary).toMatchObject({
      generated: 0,
      failed: 1,
      apiRequestCount: 3,
      retryCount: 2,
      lastSuccessfulRecipeId: null
    });
    expect(saveState).toHaveBeenCalledWith(
      '.local/test-failed-state.json',
      expect.objectContaining({ status: 'failed', lastSuccessfulRecipeId: null })
    );
    consoleError.mockRestore();
  });
});
