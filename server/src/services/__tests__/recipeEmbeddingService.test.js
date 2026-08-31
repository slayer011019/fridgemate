import { describe, expect, it, vi } from 'vitest';
import { generateRecipeEmbedding, generateRecipeEmbeddings } from '../recipeEmbeddingService.js';

describe('recipeEmbeddingService', () => {
  it('generates ordered batches without exposing vectors through logs', async () => {
    const onUsage = vi.fn();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { index: 1, embedding: [0, 1, 0] },
          { index: 0, embedding: [1, 0, 0] }
        ],
        usage: { prompt_tokens: 12, total_tokens: 12 }
      })
    }));

    await expect(
      generateRecipeEmbeddings(['감자', '계란'], {
        apiKey: 'test-key',
        model: 'test-model',
        dimensions: 3,
        fetchImpl,
        onUsage
      })
    ).resolves.toEqual([
      [1, 0, 0],
      [0, 1, 0]
    ]);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({
      model: 'test-model',
      dimensions: 3,
      input: ['감자', '계란']
    });
    expect(onUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'openai',
        operation: 'recipe_embedding',
        model: 'test-model',
        dimensions: 3,
        inputCount: 2,
        promptTokens: 12,
        totalTokens: 12,
        success: true,
        status: 200
      })
    );
    const metrics = JSON.stringify(onUsage.mock.calls);
    expect(metrics).not.toContain('감자');
    expect(metrics).not.toContain('계란');
    expect(metrics).not.toContain('[1,0,0]');
  });

  it('keeps the single-input API compatible', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ index: 0, embedding: [1, 0, 0] }] })
    }));

    await expect(
      generateRecipeEmbedding('감자', { apiKey: 'test-key', dimensions: 3, fetchImpl })
    ).resolves.toEqual([1, 0, 0]);
  });

  it('records provider failures without exposing response bodies', async () => {
    const onUsage = vi.fn();
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 429 }));

    await expect(
      generateRecipeEmbeddings(['감자'], {
        apiKey: 'test-key',
        dimensions: 3,
        fetchImpl,
        onUsage
      })
    ).rejects.toThrow('status 429');
    expect(onUsage).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, status: 429, inputCount: 1 })
    );
  });

  it('aborts stalled semantic embedding requests and records a bounded failure', async () => {
    const onUsage = vi.fn();
    const fetchImpl = vi.fn(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
        })
    );

    await expect(
      generateRecipeEmbedding('감자', {
        apiKey: 'test-key',
        dimensions: 3,
        fetchImpl,
        onUsage,
        timeoutMs: 1
      })
    ).rejects.toMatchObject({
      message: 'OpenAI recipe embeddings request timed out.',
      code: 'EXTERNAL_AI_TIMEOUT',
      status: 0
    });
    expect(onUsage).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, status: 0, inputCount: 1 })
    );
  });
});
