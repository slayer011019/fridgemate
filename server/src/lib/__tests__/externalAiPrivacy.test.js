import { afterEach, describe, expect, it } from 'vitest';
import { serverConfig } from '../../config.js';
import {
  assertExternalAiOperationAllowed,
  EXTERNAL_AI_ACTIONS,
  EXTERNAL_AI_DISCLOSURE_VERSION,
  isExternalAiOperationAllowed,
  normalizeExternalAiRequestSignal,
  normalizeExternalAiText
} from '../externalAiPrivacy.js';

const originalGate = serverConfig.externalAiDataProcessingEnabled;

function createSignal(action = EXTERNAL_AI_ACTIONS.semanticRecipes) {
  return {
    action,
    disclosureVersion: EXTERNAL_AI_DISCLOSURE_VERSION,
    userInitiated: true
  };
}

describe('external AI privacy gate', () => {
  afterEach(() => {
    serverConfig.externalAiDataProcessingEnabled = originalGate;
  });

  it('requires both the operator gate and the exact per-request action signal', () => {
    const signal = createSignal();
    serverConfig.externalAiDataProcessingEnabled = false;
    expect(isExternalAiOperationAllowed(signal, EXTERNAL_AI_ACTIONS.semanticRecipes)).toBe(false);
    expect(() =>
      assertExternalAiOperationAllowed(signal, EXTERNAL_AI_ACTIONS.semanticRecipes)
    ).toThrow('not enabled by the service operator');

    serverConfig.externalAiDataProcessingEnabled = true;
    expect(isExternalAiOperationAllowed(null, EXTERNAL_AI_ACTIONS.semanticRecipes)).toBe(false);
    expect(
      isExternalAiOperationAllowed(signal, EXTERNAL_AI_ACTIONS.importCorrectionSuggestions)
    ).toBe(false);
    expect(isExternalAiOperationAllowed(signal, EXTERNAL_AI_ACTIONS.semanticRecipes)).toBe(true);
  });

  it('rejects stale, forged, and over-broad request signals', () => {
    expect(() =>
      normalizeExternalAiRequestSignal(
        { ...createSignal(), disclosureVersion: 'old' },
        EXTERNAL_AI_ACTIONS.semanticRecipes
      )
    ).toThrow('invalid or out of date');
    expect(() =>
      normalizeExternalAiRequestSignal(
        { ...createSignal(), userInitiated: false },
        EXTERNAL_AI_ACTIONS.semanticRecipes
      )
    ).toThrow('invalid or out of date');
    expect(() =>
      normalizeExternalAiRequestSignal(
        { ...createSignal(), allPurposes: true },
        EXTERNAL_AI_ACTIONS.semanticRecipes
      )
    ).toThrow('invalid or out of date');
  });

  it.each([
    'victim@example.com',
    '010-1234-5678',
    '900101-1234567',
    '4111 1111 1111 1111',
    'https://private.example/order/1',
    '서울특별시 중구 세종대로 110'
  ])('rejects likely sensitive free text before provider processing: %s', (value) => {
    expect(() => normalizeExternalAiText(value, 'ingredient')).toThrow(
      'must not contain personal, sensitive, or receipt-level data'
    );
  });

  it('normalizes a bounded ingredient name without returning the original object', () => {
    expect(normalizeExternalAiText('  순두부   1팩  ', 'ingredient')).toBe('순두부 1팩');
  });
});
