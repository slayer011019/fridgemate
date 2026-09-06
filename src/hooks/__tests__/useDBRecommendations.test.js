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
      getRecipeRecommendations: vi.fn(),
      getSemanticRecipeRecommendations: vi.fn()
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
  getRecipeRecommendations: (...args) => apiMocks.getRecipeRecommendations(...args),
  getSemanticRecipeRecommendations: (...args) => apiMocks.getSemanticRecipeRecommendations(...args)
}));

vi.mock('../useAuth.js', () => ({
  useAuth: () => authState
}));

vi.mock('../../utils/backendConfig.js', () => ({
  isBackendEnabled: () => backendState.enabled
}));

function HookProbe({ ingredients = defaultIngredients, pantryItems = defaultPantryItems, showRow = true, onState }) {
  const state = useDBRecommendations({ ingredients, pantryItems });

  useEffect(() => {
    onState(state);
  }, [onState, state]);

  return showRow ? createElement('section', { ref: state.rowRef, 'data-testid': 'db-row' }) : null;
}

describe('useDBRecommendations', () => {
  beforeEach(() => {
    apiMocks.getRecipeRecommendations.mockReset();
    apiMocks.getSemanticRecipeRecommendations.mockReset();
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
      expect(apiMocks.getRecipeRecommendations).toHaveBeenCalledWith(
        [{ id: 'i1', name: '계란' }],
        ['소금'],
        {
          preferredIngredients: [],
          dislikedIngredients: [],
          spiceLevel: 'medium',
          cookingTimePreference: 'flexible'
        }
      );
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

  it('starts observing when ingredient loading mounts the row after authentication', async () => {
    let latestState;
    const onState = (state) => { latestState = state; };
    apiMocks.getRecipeRecommendations.mockResolvedValue([{ id: 'late-recipe', title: '계란찜' }]);
    const view = render(createElement(HookProbe, { onState, showRow: false }));

    expect(observerInstances).toHaveLength(0);
    expect(apiMocks.getRecipeRecommendations).not.toHaveBeenCalled();

    view.rerender(createElement(HookProbe, { onState, showRow: true }));
    expect(observerInstances).toHaveLength(1);
    expect(observerInstances[0].observe).toHaveBeenCalledWith(view.getByTestId('db-row'));
    expect(apiMocks.getRecipeRecommendations).not.toHaveBeenCalled();

    await act(async () => {
      observerInstances[0].callback([{ isIntersecting: true }]);
    });

    await waitFor(() => expect(latestState.recommendations).toEqual([{ id: 'late-recipe', title: '계란찜' }]));
    expect(apiMocks.getSemanticRecipeRecommendations).not.toHaveBeenCalled();
  });

  it('disconnects a removed row and observes its replacement before viewport entry', () => {
    const onState = vi.fn();
    const view = render(createElement(HookProbe, { onState }));
    expect(observerInstances).toHaveLength(1);

    view.rerender(createElement(HookProbe, { onState, showRow: false }));
    expect(observerInstances[0].disconnect).toHaveBeenCalled();
    view.rerender(createElement(HookProbe, { onState, showRow: true }));

    expect(observerInstances).toHaveLength(2);
    expect(observerInstances[1].observe).toHaveBeenCalledWith(view.getByTestId('db-row'));
    expect(apiMocks.getRecipeRecommendations).not.toHaveBeenCalled();
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

  it('requests semantic processing only from the exported explicit action', async () => {
    let latestState;
    apiMocks.getSemanticRecipeRecommendations.mockResolvedValue({
      mode: 'semantic',
      recommendations: [{ id: 'r2', title: '계란밥' }]
    });

    render(createElement(HookProbe, { onState: (state) => { latestState = state; } }));

    expect(apiMocks.getSemanticRecipeRecommendations).not.toHaveBeenCalled();
    await act(async () => {
      await latestState.requestExternalAiRecommendations();
    });

    expect(apiMocks.getSemanticRecipeRecommendations).toHaveBeenCalledWith(
      defaultIngredients,
      defaultPantryItems,
      expect.any(Object),
      { userInitiated: true }
    );
    expect(latestState.mode).toBe('semantic');
    expect(latestState.recommendations).toEqual([{ id: 'r2', title: '계란밥' }]);
  });
});
