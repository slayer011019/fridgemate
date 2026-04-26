import { beforeEach, describe, expect, it, vi } from 'vitest';

const ingredientsApiMocks = {
  saveIngredients: vi.fn()
};

const dbMocks = {
  getAllIngredients: vi.fn(),
  replaceIngredients: vi.fn()
};

vi.mock('../../../api/ingredientsApi.js', () => ({
  saveIngredients: (...args) => ingredientsApiMocks.saveIngredients(...args)
}));

vi.mock('../../../db/indexedDB.js', () => ({
  getAllIngredients: (...args) => dbMocks.getAllIngredients(...args),
  replaceIngredients: (...args) => dbMocks.replaceIngredients(...args)
}));

describe('guestImportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    dbMocks.getAllIngredients.mockResolvedValue([]);
    dbMocks.replaceIngredients.mockResolvedValue(undefined);
    ingredientsApiMocks.saveIngredients.mockResolvedValue([]);
  });

  it('shows a prompt when guest ingredients exist and there is no prior decision', async () => {
    dbMocks.getAllIngredients.mockResolvedValue([{ id: 'guest-1', name: '김치' }]);
    const { inspectGuestImportPrompt } = await import('../guestImportService.js');
    const setGuestImportPrompt = vi.fn();

    await inspectGuestImportPrompt({
      isAuthenticated: true,
      user: { id: 'user-1' },
      setGuestImportPrompt,
      defaultGuestImportPrompt: { available: false, count: 0, loading: false }
    });

    expect(setGuestImportPrompt).toHaveBeenCalledWith({
      available: true,
      count: 1,
      loading: false
    });
  });

  it('imports guest ingredients into the authenticated scope', async () => {
    dbMocks.getAllIngredients.mockResolvedValue([
      { id: 'guest-1', name: '김치', syncState: 'pending', lastSyncedAt: 'now' }
    ]);
    ingredientsApiMocks.saveIngredients.mockResolvedValue([{ id: 'remote-1', name: '김치' }]);

    const { importGuestIngredientsForUser } = await import('../guestImportService.js');
    const setGuestImportPrompt = vi.fn();
    const setError = vi.fn();

    const result = await importGuestIngredientsForUser({
      backendEnabled: true,
      user: { id: 'user-1' },
      setGuestImportPrompt,
      setError,
      defaultGuestImportPrompt: { available: false, count: 0, loading: false }
    });

    expect(result).toEqual([{ id: 'remote-1', name: '김치' }]);
    expect(ingredientsApiMocks.saveIngredients).toHaveBeenCalledWith([{ id: 'guest-1', name: '김치' }]);
    expect(dbMocks.replaceIngredients).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith('');
  });
});
