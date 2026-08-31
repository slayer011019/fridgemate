import { describe, expect, it, vi } from 'vitest';
import {
  buildRequestUrl,
  fetchRecipePage,
  parseSeedArgs,
  readResponseTextLimited,
  validateMfdsPayload
} from '../seed-mfds-recipes.js';

const API_ORIGIN = 'https://openapi.foodsafetykorea.go.kr';

function createResponse({
  body = '',
  headers = {},
  redirected = false,
  status = 200,
  url = `${API_ORIGIN}/api/test/COOKRCP01/json/1/1`
} = {}) {
  const responseHeaders = new Headers(headers);
  return {
    body: null,
    headers: responseHeaders,
    ok: status >= 200 && status < 300,
    redirected,
    status,
    text: vi.fn(async () => body),
    url
  };
}

function validPayload(rows = [{ RCP_SEQ: '1', RCP_NM: '안전한 레시피' }]) {
  return {
    COOKRCP01: {
      RESULT: { CODE: 'INFO-000', MSG: 'OK' },
      row: rows,
      total_count: String(rows.length)
    }
  };
}

describe('MFDS recipe seed safety', () => {
  it('uses only the trusted HTTPS API origin and encodes the API key path segment', () => {
    const url = buildRequestUrl({ apiKey: 'secret/key', startIdx: 1, endIdx: 10 });

    expect(url).toBe(
      `${API_ORIGIN}/api/secret%2Fkey/COOKRCP01/json/1/10`
    );
    expect(url.startsWith('https://')).toBe(true);
    expect(() => buildRequestUrl({ apiKey: 'key', startIdx: 1, endIdx: 1001 })).toThrow(/range/i);
  });

  it('defaults to a bounded dry run and requires unambiguous CLI modes', () => {
    expect(parseSeedArgs([])).toMatchObject({
      execute: false,
      isAll: false,
      isDryRun: true,
      limit: 10
    });
    expect(parseSeedArgs(['--all'])).toMatchObject({ isAll: true, isDryRun: true, limit: 0 });
    expect(() => parseSeedArgs(['--all', '--limit=10'])).toThrow(/cannot be used together/i);
    expect(() => parseSeedArgs(['--limit=invalid'])).toThrow(/positive integer/i);
  });

  it('refuses cross-origin redirects before following them', async () => {
    const fetchImpl = vi.fn(async (url) =>
      createResponse({
        headers: { location: 'https://attacker.example/collect' },
        status: 302,
        url
      })
    );

    await expect(
      fetchRecipePage({ apiKey: 'do-not-log-this', startIdx: 1, endIdx: 1, fetchImpl })
    ).rejects.toThrow(/trusted HTTPS API origin/i);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('follows only same-origin redirects and validates the final response origin', async () => {
    const payload = JSON.stringify(validPayload());
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(async (url) =>
        createResponse({ headers: { location: '/api/redirected' }, status: 302, url })
      )
      .mockImplementationOnce(async (url) =>
        createResponse({ body: payload, headers: { 'content-type': 'application/json' }, url })
      );

    await expect(
      fetchRecipePage({ apiKey: 'key', startIdx: 1, endIdx: 1, fetchImpl })
    ).resolves.toMatchObject({ rows: [{ RCP_SEQ: '1', RCP_NM: '안전한 레시피' }], totalCount: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const untrustedResponse = vi.fn(async () =>
      createResponse({
        body: payload,
        headers: { 'content-type': 'application/json' },
        url: 'https://attacker.example/api/result'
      })
    );
    await expect(
      fetchRecipePage({ apiKey: 'key', startIdx: 1, endIdx: 1, fetchImpl: untrustedResponse })
    ).rejects.toThrow(/trusted HTTPS API origin/i);

    const automaticallyRedirected = vi.fn(async (url) =>
      createResponse({
        body: payload,
        headers: { 'content-type': 'application/json' },
        redirected: true,
        url
      })
    );
    await expect(
      fetchRecipePage({ apiKey: 'key', startIdx: 1, endIdx: 1, fetchImpl: automaticallyRedirected })
    ).rejects.toThrow(/does not match/i);
  });

  it('rejects oversized bodies, invalid schema, inconsistent counts, and duplicate IDs', async () => {
    await expect(readResponseTextLimited(createResponse({ body: '1234' }), 3)).rejects.toThrow(/size/i);
    const declaredOversize = createResponse({ body: '1', headers: { 'content-length': '4' } });
    await expect(readResponseTextLimited(declaredOversize, 3)).rejects.toThrow(/size/i);
    expect(declaredOversize.text).not.toHaveBeenCalled();
    expect(() => validateMfdsPayload({}, { requestedCount: 1 })).toThrow(/service envelope/i);
    expect(() =>
      validateMfdsPayload(validPayload([{ RCP_SEQ: '1', RCP_NM: 'A' }]), { requestedCount: 0 })
    ).toThrow(/row count/i);
    expect(() =>
      validateMfdsPayload(
        validPayload([
          { RCP_SEQ: '1', RCP_NM: 'A' },
          { RCP_SEQ: '1', RCP_NM: 'B' }
        ]),
        { requestedCount: 2 }
      )
    ).toThrow(/duplicate/i);
    expect(() =>
      validateMfdsPayload(validPayload([{ RCP_SEQ: '1', RCP_NM: 'A', NESTED: {} }]), {
        requestedCount: 1
      })
    ).toThrow(/non-scalar/i);
    expect(() =>
      validateMfdsPayload(validPayload([{ RCP_SEQ: '1', RCP_NM: 'A' }]), {
        requestedCount: 1,
        startIdx: 2
      })
    ).toThrow(/row count/i);
  });

  it('does not include response bodies or API keys in validation errors', async () => {
    const secret = 'api-secret-that-must-not-appear';
    const fetchImpl = vi.fn(async (url) =>
      createResponse({ body: `invalid ${secret}`, headers: { 'content-type': 'application/json' }, url })
    );

    let message = '';
    try {
      await fetchRecipePage({ apiKey: secret, startIdx: 1, endIdx: 1, fetchImpl });
    } catch (error) {
      message = error.message;
    }

    expect(message).toBe('Food Safety Korea returned invalid JSON.');
    expect(message).not.toContain(secret);
  });
});
