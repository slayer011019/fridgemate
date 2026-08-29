import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, requestJson } from '../apiClient.js';

describe('apiClient request correlation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retains the server request id on API errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 500,
        headers: new Headers({ 'x-request-id': 'request-header' }),
        json: async () => ({
          message: 'Internal server error.',
          requestId: 'request-body'
        })
      }))
    );

    const error = await requestJson('/ingredients').catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      message: 'Internal server error.',
      status: 500,
      path: '/ingredients',
      requestId: 'request-body'
    });
  });
});
