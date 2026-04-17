import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../useIngredients.js', () => ({
  useIngredients: () => ({
    ingredients: [
      { id: '1', name: '계란', expiryDate: '2026-03-20', consumed: false },
      { id: '2', name: '밥', expiryDate: '2026-03-28', consumed: false }
    ],
    loading: false
  })
}));

vi.mock('../usePantryStaples.js', () => ({
  usePantryStaples: () => ({
    pantryOwnership: { salt: 'owned' }
  })
}));

describe('useHomePageModel', () => {
  it('returns derived dashboard values from hook dependencies', async () => {
    const { useHomePageModel } = await import('../useHomePageModel.js');
    const { result } = renderHook(() => useHomePageModel());

    expect(result.current.loading).toBe(false);
    expect(result.current.summary.total).toBe(2);
    expect(result.current.urgentCount).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.current.topRecommendations)).toBe(true);
    expect(Array.isArray(result.current.upcomingItems)).toBe(true);
  });
});
