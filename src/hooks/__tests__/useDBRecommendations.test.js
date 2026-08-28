import { act, render, waitFor } from '@testing-library/react';
import { createElement, useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDBRecommendations } from '../useDBRecommendations.js';

const { MockRecipesApiError, apiMocks, authState, backendState } = vi.hoisted(() => {
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
    }
  };
});

const observerInstances = [];
const defaultIngredients = [{ id: 'i1', name: '계란' }];
const defaultPantryItems = ['소금'];

class MockIntersectionObserver {
  constructor(callback) {
    this.callback = callback;
    this.observe = vi.fn();
    this.disconnect = vi.fn();
    observerInstances.push(this);
  }
}

vi.mock('../../api/recipesApi.js', () => ({
  RecipesApiError: MockRecipesApiError,
  getRecipeRecommendations: (...args) => apiMocks.getRecipeRecommendations(...args)
}));

vi.mock('../useAuth.js', () => ({
  useAuth: () => authState
}));

vi.mock('../../utils/backendConfig.js', () => ({
  isBackendEnabled: () => backendState.enabled
}));

function HookProbe({ ingredients = defaultIngredients, pantryItems = defaultPantryItems, onState }) {
  const state = useDBRecommendations({ ingredients, pantryItems });

  useEffect(() => {
    onState(state);
  }, [onState, state]);

  return createElement('section', { ref: state.rowRef, 'data-testid': 'db-row' });
}

describe('useDBRecommendations', () => {
  beforeEach(() => {
    apiMocks.getRecipeRecommendations.mockReset();
    authState.isAuthenticated = true;
    backendState.enabled = true;
    observerInstances.length = 0;
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('waits for viewport entry before fetching DB recommendations', async () => {
    let latestState;
    apiMocks.getRecipeRecommendations.mockResolvedValue([{ id: 'r1', title: '계란찜', score: 80 }]);

    render(createElement(HookProbe, { onState: (state) => { latestState = state; } }));

    expect(apiMocks.getRecipeRecommendations).not.toHaveBeenCalled();
    expect(observerInstances[0].observe).toHaveBeenCalled();

    await act(async () => {
      observerInstances[0].callback([{ isIntersecting: true }]);
    });

    await waitFor(() => {
      expect(apiMocks.getRecipeRecommendations).toHaveBeenCalledWith([{ id: 'i1', name: '계란' }], ['소금']);
    });
    await waitFor(() => {
      expect(latestState.recommendations).toEqual([{ id: 'r1', title: '계란찜', score: 80 }]);
    });
  });

  it('exposes a login CTA state without fetching when logged out', () => {
    let latestState;
    authState.isAuthenticated = false;

    render(createElement(HookProbe, { onState: (state) => { latestState = state; } }));

    expect(latestState.needsLogin).toBe(true);
    expect(apiMocks.getRecipeRecommendations).not.toHaveBeenCalled();
    expect(observerInstances).toHaveLength(0);
  });

  it('hides the row for network and server failures', async () => {
    let latestState;
    apiMocks.getRecipeRecommendations.mockRejectedValue(new MockRecipesApiError('Server down.', { status: 500 }));

    render(createElement(HookProbe, { onState: (state) => { latestState = state; } }));

    await act(async () => {
      observerInstances[0].callback([{ isIntersecting: true }]);
    });

    await waitFor(() => {
      expect(latestState.hidden).toBe(true);
    });
    expect(latestState.error).toBe('');
  });

  it('hides the DB row after a complete network failure', async () => {
    let latestState;
    apiMocks.getRecipeRecommendations.mockRejectedValue(new MockRecipesApiError('Network down.'));

    render(createElement(HookProbe, { onState: (state) => { latestState = state; } }));

    await act(async () => {
      observerInstances[0].callback([{ isIntersecting: true }]);
    });

    await waitFor(() => {
      expect(latestState.hidden).toBe(true);
    });
    expect(latestState.recommendations).toEqual([]);
    expect(latestState.error).toBe('');
  });

  it('keeps the row visible with inline errors for 4xx failures', async () => {
    let latestState;
    apiMocks.getRecipeRecommendations.mockRejectedValue(new MockRecipesApiError('로그인이 필요합니다.', { status: 401 }));

    render(createElement(HookProbe, { onState: (state) => { latestState = state; } }));

    await act(async () => {
      observerInstances[0].callback([{ isIntersecting: true }]);
    });

    await waitFor(() => {
      expect(latestState.error).toBe('로그인이 필요합니다.');
    });
    expect(latestState.hidden).toBe(false);
  });
});
