import { describe, expect, it, vi } from 'vitest';
import { generateRecipeEmbedding, generateRecipeEmbeddings } from '../recipeEmbeddingService.js';

describe('recipeEmbeddingService', () => {
  it('generates ordered batches without exposing vectors through logs', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [
          { index: 1, embedding: [0, 1, 0] },
          { index: 0, embedding: [1, 0, 0] }
        ]
      })
    }));

    await expect(
      generateRecipeEmbeddings(['감자', '계란'], {
        apiKey: 'test-key',
        model: 'test-model',
        dimensions: 3,
        fetchImpl
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
  });

  it('keeps the single-input API compatible', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ index: 0, embedding: [1, 0, 0] }] })
    }));

    await expect(
      generateRecipeEmbedding('감자', { apiKey: 'test-key', dimensions: 3, fetchImpl })
    ).resolves.toEqual([1, 0, 0]);
  });
});
