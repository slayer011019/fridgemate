import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildUserStorageScope,
  clearStoredAuthSession,
  getGuestImportDecision,
  getStoredAuthSession,
  GUEST_STORAGE_SCOPE,
  saveStoredAuthSession,
  setGuestImportDecision
} from '../authStorage.js';

describe('authStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('stores and restores an auth session', () => {
    const session = {
      user: {
        id: 'user-1',
        email: 'hello@example.com'
      }
    };

    saveStoredAuthSession(session);

    expect(getStoredAuthSession()).toEqual(session);
  });

  it('clears an auth session', () => {
    saveStoredAuthSession({
      user: {
        id: 'user-1',
        email: 'hello@example.com'
      }
    });

    clearStoredAuthSession();

    expect(getStoredAuthSession()).toBeNull();
  });

  it('tracks guest import decisions per user', () => {
    setGuestImportDecision('user-1', 'dismissed');

    expect(getGuestImportDecision('user-1')).toBe('dismissed');
    expect(getGuestImportDecision('user-2')).toBe('');
  });

  it('builds clear storage scopes', () => {
    expect(buildUserStorageScope('user-1')).toBe('user:user-1');
    expect(GUEST_STORAGE_SCOPE).toBe('guest');
  });
});
