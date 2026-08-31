import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createExternalAiRequestSignal,
  EXTERNAL_AI_ACTIONS,
  EXTERNAL_AI_DISCLOSURE_VERSION,
  isExternalAiUiEnabled
} from '../externalAiRequest.js';

describe('external AI client activation gate', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('stays off by default and ignores a click-shaped value while disabled', () => {
    vi.stubEnv('VITE_ENABLE_EXTERNAL_AI_DATA_PROCESSING', 'false');

    expect(isExternalAiUiEnabled()).toBe(false);
    expect(
      createExternalAiRequestSignal(EXTERNAL_AI_ACTIONS.semanticRecipes, {
        userInitiated: true
      })
    ).toBeNull();
  });

  it('creates only a request-scoped signal after both client activation and a user action', () => {
    vi.stubEnv('VITE_ENABLE_EXTERNAL_AI_DATA_PROCESSING', 'true');

    expect(createExternalAiRequestSignal(EXTERNAL_AI_ACTIONS.semanticRecipes)).toBeNull();
    expect(
      createExternalAiRequestSignal(EXTERNAL_AI_ACTIONS.semanticRecipes, {
        userInitiated: true
      })
    ).toEqual({
      action: EXTERNAL_AI_ACTIONS.semanticRecipes,
      disclosureVersion: EXTERNAL_AI_DISCLOSURE_VERSION,
      userInitiated: true
    });
  });
});
