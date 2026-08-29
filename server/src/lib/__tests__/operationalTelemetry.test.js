import { describe, expect, it, vi } from 'vitest';
import {
  buildAiUsageEvent,
  recordAiUsage,
  recordRecommendationFallback
} from '../operationalTelemetry.js';

describe('operationalTelemetry', () => {
  it('builds a bounded token and cost event without accepting prompt or vector fields', () => {
    const event = buildAiUsageEvent(
      {
        provider: 'openai',
        operation: 'recipe_embedding',
        model: 'text-embedding-3-small',
        dimensions: 1536,
        inputCount: 10,
        promptTokens: 2500,
        totalTokens: 2500,
        durationMs: 420,
        prompt: 'private ingredient list',
        embedding: [0.1, 0.2]
      },
      { recipeEmbeddingPricePerMillionTokens: 0.02 }
    );

    expect(event).toEqual({
      event: 'ai_usage',
      provider: 'openai',
      operation: 'recipe_embedding',
      model: 'text-embedding-3-small',
      dimensions: 1536,
      success: true,
      status: null,
      inputCount: 10,
      promptTokens: 2500,
      totalTokens: 2500,
      durationMs: 420,
      estimatedCostUsd: 0.00005
    });
    expect(event).not.toHaveProperty('prompt');
    expect(event).not.toHaveProperty('embedding');
  });

  it('writes metrics only when usage logging is enabled', () => {
    const logger = { info: vi.fn(), warn: vi.fn() };
    const metrics = { provider: 'openai', operation: 'recipe_embedding', success: true };

    expect(
      recordAiUsage(metrics, {
        config: { aiUsageLoggingEnabled: false, recipeEmbeddingPricePerMillionTokens: 0 },
        logger
      })
    ).toBeNull();
    expect(logger.info).not.toHaveBeenCalled();

    recordAiUsage(metrics, {
      config: { aiUsageLoggingEnabled: true, recipeEmbeddingPricePerMillionTokens: 0 },
      logger
    });
    expect(logger.info).toHaveBeenCalledWith(
      '[server] ai usage',
      expect.objectContaining({ event: 'ai_usage', provider: 'openai' })
    );
  });

  it('records fallback classification without logging raw error messages', () => {
    const logger = { warn: vi.fn() };
    const event = recordRecommendationFallback(
      'hybrid_recipe_recommendations',
      {
        name: 'DatabaseError',
        code: 'DB_DOWN',
        message: 'postgresql://private-user:private-pass@example.com'
      },
      { logger }
    );

    expect(event).toEqual({
      event: 'recommendation_fallback',
      source: 'hybrid_recipe_recommendations',
      errorName: 'DatabaseError',
      errorCode: 'DB_DOWN'
    });
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('private-pass');
  });
});
