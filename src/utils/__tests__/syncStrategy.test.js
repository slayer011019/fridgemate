import { describe, expect, it } from 'vitest';
import {
  markIngredientAsPending,
  markIngredientAsSynced,
  resolveIngredientConflict,
  syncIngredientSnapshot
} from '../syncStrategy.js';

function createIngredient(id, overrides = {}) {
  return {
    id,
    name: `ingredient-${id}`,
    updatedAt: '2026-04-04T10:00:00.000Z',
    ...overrides
  };
}

describe('syncStrategy', () => {
  it('marks remote ingredients as clean when syncing', () => {
    const ingredient = markIngredientAsSynced(createIngredient('synced'));

    expect(ingredient.syncState).toBe('clean');
    expect(ingredient.lastSyncedAt).toBe('2026-04-04T10:00:00.000Z');
  });

  it('keeps a newer pending local ingredient when the remote copy is older', () => {
    const localIngredient = markIngredientAsPending(
      createIngredient('local', { updatedAt: '2026-04-04T11:00:00.000Z' }),
      'pendingUpdate'
    );
    const remoteIngredient = createIngredient('local', { updatedAt: '2026-04-04T10:00:00.000Z' });

    const resolvedIngredient = resolveIngredientConflict({
      localIngredient,
      remoteIngredient
    });

    expect(resolvedIngredient.syncState).toBe('pendingUpdate');
    expect(resolvedIngredient.updatedAt).toBe('2026-04-04T11:00:00.000Z');
  });

  it('prefers the remote ingredient and marks a conflict when a pending local copy is older', () => {
    const localIngredient = markIngredientAsPending(
      createIngredient('conflict', { updatedAt: '2026-04-04T09:00:00.000Z' }),
      'pendingUpdate'
    );
    const remoteIngredient = createIngredient('conflict', { updatedAt: '2026-04-04T12:00:00.000Z' });

    const resolvedIngredient = resolveIngredientConflict({
      localIngredient,
      remoteIngredient
    });

    expect(resolvedIngredient.syncState).toBe('conflict');
    expect(resolvedIngredient.updatedAt).toBe('2026-04-04T12:00:00.000Z');
  });

  it('drops a clean local ingredient when it no longer exists remotely', () => {
    const resolvedIngredient = resolveIngredientConflict({
      localIngredient: markIngredientAsSynced(createIngredient('stale-local')),
      remoteIngredient: null
    });

    expect(resolvedIngredient).toBeNull();
  });

  it('keeps a newer local cached ingredient as a pending update when it is ahead of the remote copy', () => {
    const resolvedIngredient = resolveIngredientConflict({
      localIngredient: markIngredientAsSynced(
        createIngredient('ahead-local', {
          updatedAt: '2026-04-04T12:00:00.000Z',
          lastSyncedAt: '2026-04-04T10:00:00.000Z'
        })
      ),
      remoteIngredient: createIngredient('ahead-local', {
        updatedAt: '2026-04-04T11:00:00.000Z'
      })
    });

    expect(resolvedIngredient.syncState).toBe('pendingUpdate');
    expect(resolvedIngredient.updatedAt).toBe('2026-04-04T12:00:00.000Z');
  });

  it('builds a merged snapshot with pending uploads and downloads', async () => {
    const localIngredients = [
      markIngredientAsPending(createIngredient('pending', { updatedAt: '2026-04-04T11:00:00.000Z' }), 'pendingCreate'),
      markIngredientAsSynced(createIngredient('stale-local', { updatedAt: '2026-04-04T09:00:00.000Z' }))
    ];
    const remoteIngredients = [createIngredient('remote-only', { updatedAt: '2026-04-04T12:00:00.000Z' })];

    const result = await syncIngredientSnapshot({
      localIngredients,
      remoteIngredients
    });

    expect(result.pendingUploads).toHaveLength(1);
    expect(result.pendingDownloads).toHaveLength(1);
    expect(result.nextSnapshot.map((ingredient) => ingredient.id).sort()).toEqual(['pending', 'remote-only']);
  });
});
