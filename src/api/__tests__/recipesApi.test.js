import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { requestJsonMock } = vi.hoisted(() => ({ requestJsonMock: vi.fn() }));

vi.mock('../apiClient.js', () => ({
  ApiClientError: class ApiClientError extends Error {},
  requestJson: requestJsonMock
}));

import {
  aiSuggestRecipes,
  getSemanticRecipeRecommendations
} from '../recipesApi.js';

describe('recipe external AI client requests', () => {
  beforeEach(() => {
    requestJsonMock.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-30T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('does not contact the semantic endpoint while the client gate is disabled', async () => {
    vi.stubEnv('VITE_ENABLE_EXTERNAL_AI_DATA_PROCESSING', 'false');

    await expect(
      getSemanticRecipeRecommendations([{ name: '계란' }], [], {}, { userInitiated: true })
    ).resolves.toMatchObject({ mode: 'rule-fallback', recommendations: [] });
    expect(requestJsonMock).not.toHaveBeenCalled();
  });

  it('sends only active ingredient names and a coarse expiry list after the disclosed click', async () => {
    vi.stubEnv('VITE_ENABLE_EXTERNAL_AI_DATA_PROCESSING', 'true');
    requestJsonMock.mockResolvedValue({ mode: 'semantic', recommendations: [] });

    await getSemanticRecipeRecommendations(
      [
        { name: '계란', expiryDate: '2026-08-31', quantity: '2개' },
        { name: '우유', expiryDate: '2026-09-10', consumed: true },
        { name: '두부', expiryDate: '2026-09-01', deletedAt: '2026-08-29' }
      ],
      ['간장'],
      {},
      { userInitiated: true }
    );

    const body = JSON.parse(requestJsonMock.mock.calls[0][1].body);
    expect(body.availableIngredients).toEqual(['계란']);
    expect(body.expiringIngredients).toEqual(['계란']);
    expect(JSON.stringify(body)).not.toContain('2026-08-31');
    expect(JSON.stringify(body)).not.toContain('quantity');
    expect(body.externalAi).toMatchObject({
      action: 'semantic_recipe_recommendations',
      userInitiated: true
    });
  });

  it('minimizes Anthropic request fields to name and coarse expiry state', async () => {
    vi.stubEnv('VITE_ENABLE_EXTERNAL_AI_DATA_PROCESSING', 'true');
    requestJsonMock.mockResolvedValue([]);

    await aiSuggestRecipes(
      [{ name: '계란', expiryDate: '2026-08-31', quantity: 'victim@example.com' }],
      { userInitiated: true }
    );

    const body = JSON.parse(requestJsonMock.mock.calls[0][1].body);
    expect(body.ingredients).toEqual([{ name: '계란', expiresSoon: true }]);
    expect(JSON.stringify(body)).not.toContain('2026-08-31');
    expect(JSON.stringify(body)).not.toContain('victim@example.com');
    expect(body.externalAi.action).toBe('ai_recipe_suggestions');
  });
});
