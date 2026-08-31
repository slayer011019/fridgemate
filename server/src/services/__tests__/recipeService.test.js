import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  recommendHybridRecipes: vi.fn(),
  withUserDatabaseScope: vi.fn()
}));

vi.mock('../../db/tenantScope.js', () => ({
  withUserDatabaseScope: serviceMocks.withUserDatabaseScope
}));

vi.mock('../recipeHybridRecommendationService.js', () => ({
  recommendRecipes: serviceMocks.recommendHybridRecipes
}));

import { serverConfig } from '../../config.js';
import {
  EXTERNAL_AI_ACTIONS,
  EXTERNAL_AI_DISCLOSURE_VERSION
} from '../../lib/externalAiPrivacy.js';
import { getAiRecipeSuggestions, getRecipeRecommendations } from '../recipeService.js';

const originalSemanticFlag = serverConfig.semanticRecipeApiEnabled;
const originalExternalAiGate = serverConfig.externalAiDataProcessingEnabled;
const originalAnthropicApiKey = serverConfig.anthropicApiKey;
const semanticExternalAi = {
  action: EXTERNAL_AI_ACTIONS.semanticRecipes,
  disclosureVersion: EXTERNAL_AI_DISCLOSURE_VERSION,
  userInitiated: true
};
const suggestionExternalAi = {
  action: EXTERNAL_AI_ACTIONS.aiRecipeSuggestions,
  disclosureVersion: EXTERNAL_AI_DISCLOSURE_VERSION,
  userInitiated: true
};

describe('recipeService semantic rollout flag', () => {
  beforeEach(() => {
    serviceMocks.findMany.mockReset();
    serviceMocks.recommendHybridRecipes.mockReset();
    serviceMocks.withUserDatabaseScope.mockReset();
    serviceMocks.withUserDatabaseScope.mockImplementation((_userId, operation) =>
      operation({
        ingredient: {
          findMany: serviceMocks.findMany
        }
      })
    );
    serviceMocks.findMany.mockResolvedValue([]);
    serviceMocks.recommendHybridRecipes.mockResolvedValue([]);
  });

  afterEach(() => {
    serverConfig.semanticRecipeApiEnabled = originalSemanticFlag;
    serverConfig.externalAiDataProcessingEnabled = originalExternalAiGate;
    serverConfig.anthropicApiKey = originalAnthropicApiKey;
    vi.unstubAllGlobals();
  });

  it('keeps the existing endpoint on rule recommendations while the flag is disabled', async () => {
    serverConfig.semanticRecipeApiEnabled = false;

    const recommendations = await getRecipeRecommendations({
      userId: 'user-1',
      ingredients: [{ name: '계란' }],
      limit: 2
    });

    expect(recommendations).toHaveLength(2);
    expect(recommendations.every((recipe) => recipe._recommendationSource === 'rule')).toBe(true);
  });

  it('falls back without external processing while the semantic rollout flag is disabled', async () => {
    serverConfig.semanticRecipeApiEnabled = false;

    await expect(
      getRecipeRecommendations({
        userId: 'user-1',
        ingredients: [{ name: '계란' }],
        requireSemantic: true,
        externalAi: semanticExternalAi
      })
    ).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ _recommendationSource: 'rule' })]));
    expect(serviceMocks.recommendHybridRecipes).toHaveBeenCalledWith(
      [{ name: '계란' }],
      expect.objectContaining({ vectorSearch: expect.any(Function) })
    );
  });

  it('removes deleted and consumed client ingredients before semantic recommendation', async () => {
    serverConfig.semanticRecipeApiEnabled = true;
    serverConfig.externalAiDataProcessingEnabled = true;

    await getRecipeRecommendations({
      userId: 'user-1',
      ingredients: [
        { name: '계란', consumed: false, deletedAt: null },
        { name: '우유', consumed: true, deletedAt: null },
        { name: '두부', consumed: false, deletedAt: '2026-08-30T00:00:00.000Z' }
      ],
      limit: 2,
      requireSemantic: true,
      externalAi: semanticExternalAi
    });

    expect(serviceMocks.recommendHybridRecipes).toHaveBeenCalledWith(
      [{ name: '계란', consumed: false, deletedAt: null }],
      expect.objectContaining({ limit: 2 })
    );
  });

  it('filters stored fallback ingredients at the query and service boundary', async () => {
    serverConfig.semanticRecipeApiEnabled = true;
    serverConfig.externalAiDataProcessingEnabled = true;
    serviceMocks.findMany.mockResolvedValue([
      { name: '계란', expiryDate: '2026-09-01', consumed: false, deletedAt: null },
      { name: '우유', expiryDate: '2026-09-02', consumed: true, deletedAt: null },
      {
        name: '두부',
        expiryDate: '2026-09-03',
        consumed: false,
        deletedAt: new Date('2026-08-30T00:00:00.000Z')
      }
    ]);

    await getRecipeRecommendations({
      userId: 'user-1',
      ingredients: [],
      limit: 2,
      requireSemantic: true,
      externalAi: semanticExternalAi
    });

    expect(serviceMocks.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        deletedAt: null,
        consumed: false
      },
      select: {
        name: true,
        expiryDate: true,
        consumed: true,
        deletedAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    expect(serviceMocks.recommendHybridRecipes).toHaveBeenCalledWith(
      [
        {
          name: '계란',
          expiresAt: '2026-09-01',
          consumed: false,
          deletedAt: null
        }
      ],
      expect.objectContaining({ limit: 2 })
    );
  });

  it('caps body-less recommendation processing at 50 stored ingredients', async () => {
    serverConfig.semanticRecipeApiEnabled = true;
    serverConfig.externalAiDataProcessingEnabled = true;
    serviceMocks.findMany.mockResolvedValue(
      Array.from({ length: 5_000 }, (_, index) => ({
        name: `재료-${index + 1}`,
        expiryDate: null,
        consumed: false,
        deletedAt: null
      }))
    );

    await getRecipeRecommendations({
      userId: 'user-1',
      requireSemantic: true,
      externalAi: semanticExternalAi
    });

    expect(serviceMocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
    const [processedIngredients] = serviceMocks.recommendHybridRecipes.mock.calls[0];
    expect(processedIngredients).toHaveLength(50);
    expect(processedIngredients.at(-1)).toMatchObject({ name: '재료-50' });
  });

  it('never enables semantic processing on the automatic recommendation endpoint', async () => {
    serverConfig.semanticRecipeApiEnabled = true;
    serverConfig.externalAiDataProcessingEnabled = true;

    await getRecipeRecommendations({
      userId: 'user-1',
      ingredients: [{ name: '계란' }]
    });

    expect(serviceMocks.recommendHybridRecipes).toHaveBeenCalledWith(
      [{ name: '계란' }],
      expect.objectContaining({ vectorSearch: expect.any(Function) })
    );
    expect(serviceMocks.recommendHybridRecipes.mock.calls[0][1]).not.toHaveProperty('externalAi');
  });

  it('keeps Anthropic off without an exact request signal and minimizes an allowed payload', async () => {
    serverConfig.anthropicApiKey = 'test-key';
    serverConfig.externalAiDataProcessingEnabled = true;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                title: '계란 요리',
                description: '설명',
                ingredients: ['계란'],
                cookingTime: '10분',
                difficulty: '쉬움',
                tags: []
              }
            ])
          }
        ]
      })
    }));
    vi.stubGlobal('fetch', fetchMock);
    const ingredients = [
      {
        name: '계란',
        expiresAt: '2026-08-31',
        expiresSoon: true,
        quantity: 'victim@example.com'
      }
    ];

    await getAiRecipeSuggestions(ingredients);
    expect(fetchMock).not.toHaveBeenCalled();

    await getAiRecipeSuggestions(ingredients, { externalAi: suggestionExternalAi });
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const prompt = requestBody.messages[0].content;
    expect(prompt).toContain('"name":"계란"');
    expect(prompt).toContain('"useSoon":true');
    expect(prompt).not.toContain('2026-08-31');
    expect(prompt).not.toContain('victim@example.com');

    fetchMock.mockClear();
    await getAiRecipeSuggestions(
      [{ name: 'victim@example.com', expiresSoon: true }],
      { externalAi: suggestionExternalAi }
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back locally when the explicitly requested Anthropic call times out', async () => {
    serverConfig.anthropicApiKey = 'test-key';
    serverConfig.externalAiDataProcessingEnabled = true;
    const fetchImpl = vi.fn(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
        })
    );

    const suggestions = await getAiRecipeSuggestions(
      [{ name: '계란', expiresSoon: true }],
      {
        externalAi: suggestionExternalAi,
        fetchImpl,
        timeoutMs: 1
      }
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions).toEqual(expect.arrayContaining([expect.objectContaining({ title: expect.any(String) })]));
  });
});
