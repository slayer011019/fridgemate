import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearScopeState,
  getScopeState,
  getStoredLastSyncedAt,
  setStoredLastSyncedAt
} from '../ingredientsScopeState';

describe('ingredientsScopeState privacy boundaries', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearScopeState('user:user-1');
    clearScopeState('user:user-2');
  });

  it('stores sync metadata per account instead of sharing a global timestamp', () => {
    window.localStorage.setItem('fridgemate-last-synced-at', 'legacy-value');

    expect(setStoredLastSyncedAt('user:user-1', '2026-08-30T01:00:00.000Z')).toBe(true);
    expect(getStoredLastSyncedAt('user:user-1')).toBe('2026-08-30T01:00:00.000Z');
    expect(getStoredLastSyncedAt('user:user-2')).toBeNull();
    expect(window.localStorage.getItem('fridgemate-last-synced-at')).toBeNull();
  });

  it('drops both cached account state and its sync timestamp', () => {
    const previousState = getScopeState('user:user-1');
    previousState.items = [{ id: 'private-1', name: 'private ingredient' }];
    previousState.loaded = true;
    setStoredLastSyncedAt('user:user-1', '2026-08-30T01:00:00.000Z');

    expect(clearScopeState('user:user-1')).toBe(true);
    expect(getStoredLastSyncedAt('user:user-1')).toBeNull();

    const nextState = getScopeState('user:user-1');
    expect(nextState).not.toBe(previousState);
    expect(nextState.items).toEqual([]);
    expect(nextState.loaded).toBe(false);
  });
});
