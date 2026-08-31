import { describe, expect, it, vi } from 'vitest';
import { requestExternalAiJson } from '../externalAiRequest.js';

describe('externalAiRequest', () => {
  it('applies a deadline signal through response-body parsing', async () => {
    const fetchImpl = vi.fn(async (_url, init) => ({
      ok: true,
      status: 200,
      json: async () => {
        expect(init.signal).toBeInstanceOf(AbortSignal);
        expect(init.signal.aborted).toBe(false);
        return { ok: true };
      }
    }));

    await expect(
      requestExternalAiJson({
        provider: 'OpenAI embeddings',
        url: 'https://api.openai.com/v1/embeddings',
        fetchImpl,
        timeoutMs: 100
      })
    ).resolves.toEqual({ payload: { ok: true }, status: 200 });
  });

  it('aborts a stalled provider and exposes only a stable timeout error', async () => {
    const fetchImpl = vi.fn(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
        })
    );

    let receivedError;
    try {
      await requestExternalAiJson({
        provider: 'OpenAI embeddings',
        url: 'https://api.openai.com/v1/embeddings',
        fetchImpl,
        timeoutMs: 1
      });
    } catch (error) {
      receivedError = error;
    }

    expect(receivedError).toMatchObject({
      message: 'OpenAI embeddings request timed out.',
      code: 'EXTERNAL_AI_TIMEOUT',
      status: 0
    });
    expect(JSON.stringify(receivedError)).not.toContain('api.openai.com');
  });

  it('does not read or expose non-success response bodies', async () => {
    const json = vi.fn(async () => ({ secret: 'provider-response-secret' }));

    await expect(
      requestExternalAiJson({
        provider: 'Anthropic',
        url: 'https://api.anthropic.com/v1/messages',
        fetchImpl: async () => ({ ok: false, status: 429, json })
      })
    ).rejects.toMatchObject({
      message: 'Anthropic request failed with status 429.',
      code: 'EXTERNAL_AI_HTTP_ERROR',
      status: 429
    });
    expect(json).not.toHaveBeenCalled();
  });

  it('replaces provider network details with a bounded error', async () => {
    await expect(
      requestExternalAiJson({
        provider: 'Anthropic',
        url: 'https://api.anthropic.com/v1/messages',
        fetchImpl: async () => {
          throw new Error('request with x-api-key secret-value failed');
        }
      })
    ).rejects.toMatchObject({
      message: 'Anthropic request failed because of a network error.',
      code: 'EXTERNAL_AI_NETWORK_ERROR',
      status: 0
    });
  });
});
