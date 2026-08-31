import { serverConfig } from '../config.js';
import {
  EXTERNAL_AI_ACTIONS,
  isExternalAiOperationAllowed,
  normalizeExternalAiText
} from '../lib/externalAiPrivacy.js';
import { requestExternalAiJson } from '../lib/externalAiRequest.js';

function normalizeEmbeddingInput(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function isEmbeddingEnabled({
  externalAi,
  action = EXTERNAL_AI_ACTIONS.importCorrectionSuggestions
} = {}) {
  return Boolean(
    serverConfig.openaiApiKey && isExternalAiOperationAllowed(externalAi, action)
  );
}

export async function createEmbedding(input, options = {}) {
  if (!isEmbeddingEnabled(options)) {
    return null;
  }
  const normalizedInput = normalizeExternalAiText(
    normalizeEmbeddingInput(input),
    'Import correction embedding input',
    { maxLength: 400 }
  );

  const { payload } = await requestExternalAiJson({
    provider: 'OpenAI embeddings',
    url: 'https://api.openai.com/v1/embeddings',
    fetchImpl: options.fetchImpl ?? globalThis.fetch,
    timeoutMs: options.timeoutMs,
    init: {
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
    }
  });
  const embedding = payload?.data?.[0]?.embedding;

  return Array.isArray(embedding) ? embedding : null;
}

export function toVectorLiteral(embedding = []) {
  return `[${embedding.map((value) => Number(value) || 0).join(',')}]`;
}
