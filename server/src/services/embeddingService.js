import { serverConfig } from '../config.js';

function normalizeEmbeddingInput(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function isEmbeddingEnabled() {
  return Boolean(serverConfig.openaiApiKey);
}

export async function createEmbedding(input) {
  const normalizedInput = normalizeEmbeddingInput(input);

  if (!normalizedInput || !isEmbeddingEnabled()) {
    return null;
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serverConfig.openaiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: normalizedInput,
      model: serverConfig.embeddingModel,
      dimensions: serverConfig.embeddingDimensions,
      encoding_format: 'float'
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI embeddings request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const embedding = payload?.data?.[0]?.embedding;

  return Array.isArray(embedding) ? embedding : null;
}

export function toVectorLiteral(embedding = []) {
  return `[${embedding.map((value) => Number(value) || 0).join(',')}]`;
}
