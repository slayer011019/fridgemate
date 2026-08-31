import { render, waitFor } from '@testing-library/react';
import { createElement, useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedRecipes } from '../../data/seedRecipes.js';
import { buildRecipeRecommendations } from '../../utils/recommendations.js';
import { useRecipeRecommendations } from '../useRecipeRecommendations.js';

const { MockRecipesApiError, apiMocks, authState, backendState, ingredientsState } = vi.hoisted(() => {
  class RecipesApiErrorMock extends Error {
    constructor(message, options = {}) {
      super(message);
      this.name = 'RecipesApiError';
      this.status = options.status;
    }
  }

  return {
    MockRecipesApiError: RecipesApiErrorMock,
    apiMocks: {
      getRecipeRecommendations: vi.fn()
    },
    authState: {
      isAuthenticated: true
    },
    backendState: {
      enabled: true
    },
    ingredientsState: {
      ingredients: [
        { id: 'i1', name: '밥' },
        { id: 'i2', name: '김치' },
        { id: 'i3', name: '계란' },
        { id: 'i4', name: '두부' }
      ],
      loading: false
    }
  };
});

const defaultPantryItems = ['소금', '식용유'];

vi.mock('../../api/recipesApi.js', () => ({
  RecipesApiError: MockRecipesApiError,
  getRecipeRecommendations: (...args) => apiMocks.getRecipeRecommendations(...args)
}));

vi.mock('../useAuth.js', () => ({
  useAuth: () => authState
}));

vi.mock('../useIngredients.js', () => ({
  useIngredients: () => ingredientsState
}));

vi.mock('../../utils/backendConfig.js', () => ({
  isBackendEnabled: () => backendState.enabled
}));

function HookProbe({ pantryItems = defaultPantryItems, onState }) {
  const state = useRecipeRecommendations(pantryItems);

  useEffect(() => {
    onState(state);
  }, [onState, state]);

  return null;
}

describe('useRecipeRecommendations', () => {
  beforeEach(() => {
    apiMocks.getRecipeRecommendations.mockReset();
    authState.isAuthenticated = true;
    backendState.enabled = true;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['a complete network failure', new MockRecipesApiError('Network down.')],
    ['a server failure', new MockRecipesApiError('Server down.', { status: 503 })]
  ])('falls back to recommendations built from all 64 local seeds after %s', async (_label, apiError) => {
    let latestState;
    const expectedRecommendations = buildRecipeRecommendations(seedRecipes, ingredientsState.ingredients, {
      pantryItems: defaultPantryItems
    });
    apiMocks.getRecipeRecommendations.mockRejectedValue(apiError);

    render(createElement(HookProbe, { onState: (state) => { latestState = state; } }));

    await waitFor(() => {
      expect(latestState.loading).toBe(false);
      expect(latestState.dataSource).toBe('local');
    });

    expect(seedRecipes).toHaveLength(64);
    expect(latestState.recommendations).toEqual(expectedRecommendations);
    expect(latestState.recommendations.length).toBeGreaterThan(0);
    expect(latestState.error).toContain('browser-based recommendations');
  });

  it('uses the 64-recipe local source directly while logged out', async () => {
    let latestState;
    const expectedRecommendations = buildRecipeRecommendations(seedRecipes, ingredientsState.ingredients, {
      pantryItems: defaultPantryItems
    });
    authState.isAuthenticated = false;

    render(createElement(HookProbe, { onState: (state) => { latestState = state; } }));

    await waitFor(() => {
      expect(latestState.loading).toBe(false);
      expect(latestState.dataSource).toBe('local');
    });

    expect(seedRecipes).toHaveLength(64);
    expect(latestState.recommendations).toEqual(expectedRecommendations);
    expect(apiMocks.getRecipeRecommendations).not.toHaveBeenCalled();
    expect(latestState.error).toBe('');
  });
});
