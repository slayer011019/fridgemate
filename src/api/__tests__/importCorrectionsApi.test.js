import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { requestJsonMock } = vi.hoisted(() => ({
  requestJsonMock: vi.fn()
}));

vi.mock('../apiClient', () => ({
  ApiClientError: class ApiClientError extends Error {},
  requestJson: requestJsonMock
}));

import {
  getImportCorrectionSuggestions,
  saveImportCorrectionsRemote,
  toCorrectionPayloadItem
} from '../importCorrectionsApi';

describe('importCorrectionsApi privacy boundary', () => {
  beforeEach(() => {
    requestJsonMock.mockReset();
    vi.stubEnv('VITE_ENABLE_REMOTE_IMPORT_LEARNING', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not contact the server while remote learning is disabled', async () => {
    const rawItem = {
      id: 'receipt-1',
      name: '우유',
      sourceLine: '010-1234-5678 서울시 중구 테스트로 1'
    };

    await expect(getImportCorrectionSuggestions([rawItem])).resolves.toEqual({ suggestions: {} });
    await expect(saveImportCorrectionsRemote([rawItem])).resolves.toEqual({ savedCount: 0 });
    expect(requestJsonMock).not.toHaveBeenCalled();
  });

  it('builds an allowlisted item without receipt text or quantity', () => {
    expect(
      toCorrectionPayloadItem({
        id: 'receipt-1',
        name: '서울우유',
        normalizedName: '우유',
        sourceLine: 'raw receipt line',
        rawLine: 'raw line',
        originalText: 'original text',
        specText: '1L',
        quantity: 2,
        category: '유제품',
        storageType: '냉장'
      })
    ).toEqual({
      id: 'receipt-1',
      normalizedName: '우유',
      correctedName: '서울우유',
      category: '유제품',
      storageType: '냉장'
    });
  });

  it('does not request OpenAI-backed suggestions without a disclosed user action', async () => {
    vi.stubEnv('VITE_ENABLE_REMOTE_IMPORT_LEARNING', 'true');
    vi.stubEnv('VITE_ENABLE_EXTERNAL_AI_DATA_PROCESSING', 'true');

    await expect(
      getImportCorrectionSuggestions([{ id: 'receipt-1', name: '우유' }])
    ).resolves.toEqual({ suggestions: {} });
    expect(requestJsonMock).not.toHaveBeenCalled();
  });

  it('sends only the allowlisted correction DTO after an explicit one-request action', async () => {
    vi.stubEnv('VITE_ENABLE_REMOTE_IMPORT_LEARNING', 'true');
    vi.stubEnv('VITE_ENABLE_EXTERNAL_AI_DATA_PROCESSING', 'true');
    requestJsonMock.mockResolvedValue({ suggestions: {} });

    await getImportCorrectionSuggestions(
      [
        {
          id: 'receipt-1',
          name: '서울우유',
          normalizedName: '우유',
          sourceLine: 'victim@example.com',
          quantity: 2,
          category: '유제품',
          storageType: '냉장'
        }
      ],
      { userInitiated: true }
    );

    const requestBody = JSON.parse(requestJsonMock.mock.calls[0][1].body);
    expect(requestBody.items).toEqual([
      {
        id: 'receipt-1',
        normalizedName: '우유',
        correctedName: '서울우유',
        category: '유제품',
        storageType: '냉장'
      }
    ]);
    expect(JSON.stringify(requestBody)).not.toContain('victim@example.com');
    expect(JSON.stringify(requestBody)).not.toContain('quantity');
    expect(requestBody.externalAi).toMatchObject({
      action: 'import_correction_suggestions',
      userInitiated: true
    });
  });
});
