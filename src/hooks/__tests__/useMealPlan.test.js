import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMealPlan } from '../useMealPlan';

const authState = { storageScope: 'guest', loading: false };
const repository = { getMealPlan: vi.fn(), saveMealPlan: vi.fn() };
vi.mock('../useAuth', () => ({ useAuth: () => authState }));
vi.mock('../../features/mealPlans/mealPlanRepository', () => ({
  getMealPlan: (...args) => repository.getMealPlan(...args),
  saveMealPlan: (...args) => repository.saveMealPlan(...args)
}));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function plan(scope = 'guest', revision = 1, weekStart = '2026-09-14') {
  return { id: `week:${weekStart}`, weekStart, scope, revision };
}

describe('useMealPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.storageScope = 'guest';
    authState.loading = false;
    repository.getMealPlan.mockResolvedValue(null);
    repository.saveMealPlan.mockImplementation(async (next) => next);
  });
  afterEach(cleanup);

  it('loads the requested scoped week and commits only after a successful save', async () => {
    const save = deferred();
    repository.saveMealPlan.mockReturnValue(save.promise);
    const { result } = renderHook(() => useMealPlan('2026-09-14'));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(repository.getMealPlan).toHaveBeenCalledWith('2026-09-14', 'guest');
    let pending;
    act(() => { pending = result.current.savePlan(plan()); });
    expect(result.current.saving).toBe(true);
    expect(result.current.plan).toBeNull();
    await act(async () => { save.resolve(plan()); await pending; });
    expect(result.current.plan).toEqual(plan());
    expect(result.current.saving).toBe(false);
  });

  it('preserves the previous plan on failed saves and permits retry', async () => {
    repository.getMealPlan.mockResolvedValue(plan());
    repository.saveMealPlan.mockRejectedValue(new Error('저장 공간 부족'));
    const { result } = renderHook(() => useMealPlan('2026-09-14'));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { expect(await result.current.savePlan(plan('guest', 2))).toBeNull(); });
    expect(result.current.plan).toEqual(plan());
    expect(result.current.error).toBe('저장 공간 부족');
    expect(result.current.ready).toBe(true);
    repository.saveMealPlan.mockImplementation(async (next) => next);
    await act(async () => { await result.current.savePlan(plan('guest', 2)); });
    expect(result.current.plan.revision).toBe(2);
    expect(result.current.error).toBe('');
  });

  it('keeps an empty editor ready after its first save fails', async () => {
    repository.saveMealPlan.mockRejectedValueOnce(new Error('저장 공간 부족'));
    const { result } = renderHook(() => useMealPlan('2026-09-14'));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { await result.current.savePlan(plan()); });
    expect(result.current.plan).toBeNull();
    expect(result.current.ready).toBe(true);
    expect(result.current.loading).toBe(false);
    await act(async () => { await result.current.savePlan(plan()); });
    expect(result.current.plan).toEqual(plan());
  });

  it('does not permit generation after a read failure until retry succeeds', async () => {
    repository.getMealPlan.mockRejectedValue(new Error('미지원 식단 형식'));
    const { result } = renderHook(() => useMealPlan('2026-09-14'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ready).toBe(false);
    await act(async () => { await result.current.savePlan(plan()); });
    expect(repository.saveMealPlan).not.toHaveBeenCalled();
    repository.getMealPlan.mockResolvedValue(null);
    act(() => result.current.retryLoad());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.error).toBe('');
  });

  it('waits for auth verification and never exposes an old account plan during a switch', async () => {
    const observed = [];
    authState.loading = true;
    repository.getMealPlan.mockImplementation(async (_week, scope) => plan(scope));
    const { result, rerender } = renderHook(() => {
      const value = useMealPlan('2026-09-14');
      observed.push({ scope: authState.storageScope, plan: value.plan });
      return value;
    });
    expect(repository.getMealPlan).not.toHaveBeenCalled();
    expect(result.current.plan).toBeNull();
    authState.loading = false;
    rerender();
    await waitFor(() => expect(result.current.plan?.scope).toBe('guest'));
    authState.storageScope = 'user:alice';
    rerender();
    await waitFor(() => expect(result.current.plan?.scope).toBe('user:alice'));
    expect(observed.every((value) => !value.plan || value.plan.scope === value.scope)).toBe(true);
    authState.loading = true;
    rerender();
    expect(result.current.plan).toBeNull();
    expect(result.current.ready).toBe(false);
  });

  it('ignores old scope and week loads that finish after navigation', async () => {
    const old = deferred();
    repository.getMealPlan.mockReturnValueOnce(old.promise).mockResolvedValue(plan('user:alice', 1, '2026-09-21'));
    const { result, rerender } = renderHook(({ week }) => useMealPlan(week), { initialProps: { week: '2026-09-14' } });
    authState.storageScope = 'user:alice';
    rerender({ week: '2026-09-21' });
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { old.resolve(plan()); await old.promise; });
    expect(result.current.plan).toEqual(plan('user:alice', 1, '2026-09-21'));
  });

  it('does not expose stale saves after switching accounts, even when returning to the original scope', async () => {
    const save = deferred();
    repository.getMealPlan.mockImplementation(async (_week, scope) => plan(scope));
    repository.saveMealPlan.mockReturnValue(save.promise);
    const { result, rerender } = renderHook(() => useMealPlan('2026-09-14'));
    await waitFor(() => expect(result.current.ready).toBe(true));
    let pending;
    act(() => { pending = result.current.savePlan(plan('guest', 2)); });
    authState.storageScope = 'user:alice';
    rerender();
    await waitFor(() => expect(result.current.plan?.scope).toBe('user:alice'));
    authState.storageScope = 'guest';
    rerender();
    await waitFor(() => expect(result.current.plan?.scope).toBe('guest'));
    await act(async () => { save.resolve(plan('guest', 2)); expect(await pending).toBeNull(); });
    expect(result.current.plan.revision).toBe(1);
    expect(repository.saveMealPlan).toHaveBeenCalledWith(plan('guest', 2), 'guest');
  });

  it('guards rapid double saves before React has rendered saving state', async () => {
    const save = deferred();
    repository.saveMealPlan.mockReturnValue(save.promise);
    const { result } = renderHook(() => useMealPlan('2026-09-14'));
    await waitFor(() => expect(result.current.ready).toBe(true));
    let first;
    let second;
    act(() => { first = result.current.savePlan(plan()); second = result.current.savePlan(plan('guest', 2)); });
    expect(repository.saveMealPlan).toHaveBeenCalledTimes(1);
    expect(await second).toBeNull();
    await act(async () => { save.resolve(plan()); await first; });
    expect(result.current.plan.revision).toBe(1);
  });

  it('rejects save callbacks captured from a previous account and mismatched input', async () => {
    const { result, rerender } = renderHook(() => useMealPlan('2026-09-14'));
    await waitFor(() => expect(result.current.ready).toBe(true));
    const oldSave = result.current.savePlan;
    authState.storageScope = 'user:alice';
    rerender();
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { await oldSave(plan()); await result.current.savePlan(plan()); });
    expect(repository.saveMealPlan).not.toHaveBeenCalled();
    expect(result.current.error).toContain('현재 계정');
  });

  it('invalidates captured save callbacks while auth is being verified', async () => {
    const { result, rerender } = renderHook(() => useMealPlan('2026-09-14'));
    await waitFor(() => expect(result.current.ready).toBe(true));
    const oldSave = result.current.savePlan;
    authState.loading = true;
    rerender();
    await act(async () => { await oldSave(plan()); });
    expect(repository.saveMealPlan).not.toHaveBeenCalled();
    authState.loading = false;
    rerender();
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { await oldSave(plan()); });
    expect(repository.saveMealPlan).not.toHaveBeenCalled();
  });
});
