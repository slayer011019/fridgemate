import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const aiSuggestRecipes = vi.fn();
const recipeRecommendationsState = {
  recommendations: [
    { id: 'r1', title: 'ready', canMakeNow: true, missingCore: [], score: 80 },
    { id: 'r2', title: 'buy', canMakeNow: false, missingCore: ['양파'], matchedCore: ['계란'], score: 40 },
    { id: 'r3', title: 'soon', canMakeNow: false, missingCore: ['양파', '대파'], score: 20 }
  ],
  loading: false,
  error: '',
  ingredients: [{ id: 'i1', name: '계란', consumed: false, expiryDate: '2026-03-19' }]
};

vi.mock('../../api/recipesApi.js', () => ({
  RecipesApiError: class RecipesApiError extends Error {},
  aiSuggestRecipes: (...args) => aiSuggestRecipes(...args)
}));

vi.mock('../useAuth.js', () => ({
  useAuth: () => ({
    isAuthenticated: true
  })
}));

vi.mock('../usePantryStaples.js', () => ({
  usePantryStaples: () => ({
    pantryStaples: [{ id: 'salt', name: '소금' }],
    pantryOwnership: { salt: 'owned' },
    pantrySummary: { owned: 1, missing: 0, unknown: 0 },
    cyclePantryStatus: vi.fn()
  })
}));

vi.mock('../useRecipeRecommendations.js', () => ({
  useRecipeRecommendations: () => recipeRecommendationsState
}));

vi.mock('../../utils/backendConfig.js', () => ({
  isBackendEnabled: () => true
}));

describe('useRecipesPageModel', () => {
  it('builds grouped recommendation sections and loads ai suggestions', async () => {
    aiSuggestRecipes.mockResolvedValue([{ title: 'AI Recipe', ingredients: ['계란'] }]);
    const { useRecipesPageModel } = await import('../useRecipesPageModel.js');
    const { result } = renderHook(() => useRecipesPageModel());

    await waitFor(() => {
      expect(result.current.aiLoading).toBe(false);
    });

    expect(result.current.readyRecommendations).toHaveLength(1);
    expect(result.current.buyOneRecommendations).toHaveLength(1);
    expect(result.current.useSoonRecommendations).toHaveLength(1);
    expect(result.current.ownedPantryCount).toBe(1);
    expect(result.current.aiRecommendations).toEqual([{ title: 'AI Recipe', ingredients: ['계란'] }]);
  });
});
