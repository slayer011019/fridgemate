import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serverConfig } from '../../config.js';
import {
  EXTERNAL_AI_ACTIONS,
  EXTERNAL_AI_DISCLOSURE_VERSION
} from '../../lib/externalAiPrivacy.js';
import { createEmbedding } from '../embeddingService.js';

const originalConfig = {
  externalAiDataProcessingEnabled: serverConfig.externalAiDataProcessingEnabled,
  openaiApiKey: serverConfig.openaiApiKey
};
const externalAi = {
  action: EXTERNAL_AI_ACTIONS.importCorrectionSuggestions,
  disclosureVersion: EXTERNAL_AI_DISCLOSURE_VERSION,
  userInitiated: true
};

describe('OpenAI import embedding boundary', () => {
  beforeEach(() => {
    serverConfig.externalAiDataProcessingEnabled = true;
    serverConfig.openaiApiKey = 'test-key';
  });

  afterEach(() => {
    serverConfig.externalAiDataProcessingEnabled = originalConfig.externalAiDataProcessingEnabled;
    serverConfig.openaiApiKey = originalConfig.openaiApiKey;
    vi.unstubAllGlobals();
  });

  it('does not call OpenAI without the exact current user-action signal', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(createEmbedding('우유')).resolves.toBeNull();
    await expect(
      createEmbedding('우유', {
        externalAi: { ...externalAi, action: EXTERNAL_AI_ACTIONS.semanticRecipes },
        action: EXTERNAL_AI_ACTIONS.importCorrectionSuggestions
      })
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls OpenAI only when the operator gate and exact signal both pass', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1, 0.2] }] })
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createEmbedding('우유', {
        externalAi,
        action: EXTERNAL_AI_ACTIONS.importCorrectionSuggestions
      })
    ).resolves.toEqual([0.1, 0.2]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects likely sensitive text after consent but before the provider call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createEmbedding('victim@example.com | 우유', {
        externalAi,
        action: EXTERNAL_AI_ACTIONS.importCorrectionSuggestions
      })
    ).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('aborts a stalled OpenAI embedding request at the provider boundary', async () => {
    const fetchImpl = vi.fn(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
        })
    );

    await expect(
      createEmbedding('우유', {
        externalAi,
        action: EXTERNAL_AI_ACTIONS.importCorrectionSuggestions,
        fetchImpl,
        timeoutMs: 1
      })
    ).rejects.toMatchObject({
      code: 'EXTERNAL_AI_TIMEOUT',
      status: 0
    });
  });
});
