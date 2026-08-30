import { recordAiUsage } from '../lib/operationalTelemetry.js';
import { requestExternalAiJson } from '../lib/externalAiRequest.js';

const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const DEFAULT_EMBEDDING_DIMENSIONS = 1536;

function getEmbeddingConfig(options = {}) {
  return {
    apiKey: options.apiKey ?? process.env.OPENAI_API_KEY ?? '',
    model: options.model ?? process.env.RECIPE_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL,
    dimensions: Number(options.dimensions ?? process.env.RECIPE_EMBEDDING_DIMENSIONS ?? DEFAULT_EMBEDDING_DIMENSIONS),
    fetchImpl: options.fetchImpl ?? globalThis.fetch,
    timeoutMs: options.timeoutMs
  };
}

/**
 * @param {string} embeddingText
 * @param {{ apiKey?: string, model?: string, dimensions?: number, fetchImpl?: typeof fetch, timeoutMs?: number }} [options]
 * @returns {Promise<number[]>}
 */
export async function generateRecipeEmbedding(embeddingText, options = {}) {
  const input = String(embeddingText || '').trim();

  if (!input) {
    throw new Error('Recipe embedding text is empty.');
  }

  const [embedding] = await generateRecipeEmbeddings([input], options);
  return embedding;
}

/**
 * Generates a bounded batch of recipe embeddings without logging inputs or vectors.
 *
 * @param {string[]} embeddingTexts
 * @param {{ apiKey?: string, model?: string, dimensions?: number, fetchImpl?: typeof fetch, timeoutMs?: number }} [options]
 * @returns {Promise<number[][]>}
 */
export async function generateRecipeEmbeddings(embeddingTexts, options = {}) {
  const inputs = Array.isArray(embeddingTexts)
    ? embeddingTexts.map((text) => String(text || '').trim())
    : [];

  if (!inputs.length || inputs.some((input) => !input)) {
    throw new Error('Recipe embedding text batch contains an empty input.');
  }

  if (inputs.length > 100) {
    throw new Error('Recipe embedding batches are limited to 100 inputs.');
  }

  const { apiKey, model, dimensions, fetchImpl, timeoutMs } = getEmbeddingConfig(options);
  const onUsage = options.onUsage || recordAiUsage;
  const startedAt = Date.now();
  const emitUsage = (metrics) => {
    try {
      onUsage({
        provider: 'openai',
        operation: 'recipe_embedding',
        model,
        dimensions,
        inputCount: inputs.length,
        durationMs: Date.now() - startedAt,
        ...metrics
      });
    } catch (_error) {
      // Telemetry must never change the embedding request outcome.
    }
  };

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured for recipe embeddings.');
  }

  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is not available for recipe embeddings.');
  }

  let payload;
  let status = 0;

  try {
    const result = await requestExternalAiJson({
      provider: 'OpenAI recipe embeddings',
      url: 'https://api.openai.com/v1/embeddings',
      fetchImpl,
      timeoutMs,
      init: {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          input: inputs,
          dimensions
        })
      }
    });
    payload = result.payload;
    status = result.status;
  } catch (error) {
    emitUsage({ success: false, status: error?.status || 0 });
    throw error;
  }
  const embeddings = Array.isArray(payload?.data)
    ? [...payload.data]
        .sort((left, right) => Number(left?.index || 0) - Number(right?.index || 0))
        .map((item) => item?.embedding)
    : [];

  if (
    embeddings.length !== inputs.length ||
    embeddings.some(
      (embedding) =>
        !Array.isArray(embedding) ||
        embedding.length !== dimensions ||
        !embedding.every((value) => Number.isFinite(value))
    )
  ) {
    emitUsage({
      success: false,
      status,
      promptTokens: payload?.usage?.prompt_tokens,
      totalTokens: payload?.usage?.total_tokens
    });
    throw new Error(`Recipe embedding response must include ${inputs.length} vectors with ${dimensions} dimensions.`);
  }

  emitUsage({
    success: true,
    status,
    promptTokens: payload?.usage?.prompt_tokens,
    totalTokens: payload?.usage?.total_tokens
  });

  return embeddings;
}
