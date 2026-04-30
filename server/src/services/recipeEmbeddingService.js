const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const DEFAULT_EMBEDDING_DIMENSIONS = 1536;

function getEmbeddingConfig(options = {}) {
  return {
    apiKey: options.apiKey ?? process.env.OPENAI_API_KEY ?? '',
    model: options.model ?? process.env.RECIPE_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL,
    dimensions: Number(options.dimensions ?? process.env.RECIPE_EMBEDDING_DIMENSIONS ?? DEFAULT_EMBEDDING_DIMENSIONS),
    fetchImpl: options.fetchImpl ?? globalThis.fetch
  };
}

/**
 * @param {string} embeddingText
 * @param {{ apiKey?: string, model?: string, dimensions?: number, fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<number[]>}
 */
export async function generateRecipeEmbedding(embeddingText, options = {}) {
  const input = String(embeddingText || '').trim();

  if (!input) {
    throw new Error('Recipe embedding text is empty.');
  }

  const { apiKey, model, dimensions, fetchImpl } = getEmbeddingConfig(options);

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured for recipe embeddings.');
  }

  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is not available for recipe embeddings.');
  }

  const response = await fetchImpl('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      input,
      dimensions
    })
  });

  if (!response.ok) {
    throw new Error(`Recipe embedding request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const embedding = payload?.data?.[0]?.embedding;

  if (!Array.isArray(embedding) || !embedding.every((value) => Number.isFinite(value))) {
    throw new Error('Recipe embedding response did not include a numeric vector.');
  }

  return embedding;
}
