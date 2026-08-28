import { describe, expect, it } from 'vitest';
import {
  getVisibleIngredients,
  markIngredientAsPending,
  markIngredientAsSynced,
  resolveIngredientConflict,
  syncIngredientSnapshot
} from '../syncStrategy.js';

function createIngredient(clientId, overrides = {}) {
  return {
    id: overrides.id || clientId,
    clientId,
    name: `ingredient-${clientId}`,
    updatedAt: '2026-08-26T10:00:00.000Z',
    deletedAt: null,
    ...overrides
  };
}

describe('syncStrategy', () => {
  it('marks remote ingredients as clean when syncing', () => {
    const ingredient = markIngredientAsSynced(createIngredient('synced'));
    expect(ingredient).toMatchObject({ syncState: 'clean', lastSyncedAt: ingredient.updatedAt });
  });

  it('keeps a pending local change when it is newer than the server copy', () => {
    const localIngredient = markIngredientAsPending(
      createIngredient('shared', { updatedAt: '2026-08-26T11:00:00.000Z' }),
      'pendingUpdate'
    );
    const remoteIngredient = createIngredient('shared', {
      id: 'server-id',
      updatedAt: '2026-08-26T10:00:00.000Z'
    });

    expect(resolveIngredientConflict({ localIngredient, remoteIngredient })).toMatchObject({
      id: 'shared',
      syncState: 'pendingUpdate',
      updatedAt: '2026-08-26T11:00:00.000Z'
    });
  });

  it('uses a newer server change and resolves an older pending local change', () => {
    const localIngredient = markIngredientAsPending(
      createIngredient('shared', { updatedAt: '2026-08-26T09:00:00.000Z' }),
      'pendingUpdate'
    );
    const remoteIngredient = createIngredient('shared', {
      id: 'server-id',
      updatedAt: '2026-08-26T12:00:00.000Z'
    });

    expect(resolveIngredientConflict({ localIngredient, remoteIngredient })).toMatchObject({
      id: 'server-id',
      clientId: 'shared',
      syncState: 'clean',
      updatedAt: '2026-08-26T12:00:00.000Z'
    });
  });

  it.each(['pendingCreate', 'pendingUpdate'])('preserves a local %s when no server copy exists', (syncState) => {
    const localIngredient = markIngredientAsPending(createIngredient(`local-${syncState}`), syncState);
    expect(resolveIngredientConflict({ localIngredient, remoteIngredient: null })).toMatchObject({ syncState });
  });

  it('keeps a local pending delete tombstone ready for upload', async () => {
    const tombstone = markIngredientAsPending(
      createIngredient('deleted', {
        updatedAt: '2026-08-26T12:00:00.000Z',
        deletedAt: '2026-08-26T12:00:00.000Z'
      }),
      'pendingDelete'
    );
    const result = await syncIngredientSnapshot({ localIngredients: [tombstone], remoteIngredients: [] });

    expect(result.pendingUploads).toEqual([expect.objectContaining({ clientId: 'deleted', syncState: 'pendingDelete' })]);
    expect(getVisibleIngredients(result.nextSnapshot)).toEqual([]);
  });

  it('does not resurrect a server tombstone from an older active device copy', async () => {
    const oldDeviceCopy = markIngredientAsPending(
      createIngredient('deleted', { updatedAt: '2026-08-26T09:00:00.000Z' }),
      'pendingUpdate'
    );
    const serverTombstone = createIngredient('deleted', {
      id: 'server-id',
      updatedAt: '2026-08-26T12:00:00.000Z',
      deletedAt: '2026-08-26T12:00:00.000Z'
    });
    const result = await syncIngredientSnapshot({
      localIngredients: [oldDeviceCopy],
      remoteIngredients: [serverTombstone]
    });

    expect(result.pendingUploads).toEqual([]);
    expect(result.conflicts).toEqual([expect.objectContaining({ clientId: 'deleted', resolution: 'remote' })]);
    expect(getVisibleIngredients(result.nextSnapshot)).toEqual([]);
  });

  it('applies a server deletion to a clean local cache', async () => {
    const localIngredient = markIngredientAsSynced(
      createIngredient('deleted', { updatedAt: '2026-08-26T10:00:00.000Z' })
    );
    const serverTombstone = createIngredient('deleted', {
      id: 'server-id',
      updatedAt: '2026-08-26T11:00:00.000Z',
      deletedAt: '2026-08-26T11:00:00.000Z'
    });
    const result = await syncIngredientSnapshot({
      localIngredients: [localIngredient],
      remoteIngredients: [serverTombstone]
    });

    expect(getVisibleIngredients(result.nextSnapshot)).toEqual([]);
    expect(result.nextSnapshot[0]).toMatchObject({ clientId: 'deleted', syncState: 'clean' });
  });

  it('drops a clean local cache record that is absent from the complete server state', async () => {
    const result = await syncIngredientSnapshot({
      localIngredients: [markIngredientAsSynced(createIngredient('stale-local'))],
      remoteIngredients: []
    });
    expect(result.nextSnapshot).toEqual([]);
  });

  it('matches records by clientId and remains idempotent when the same sync repeats', async () => {
    const local = markIngredientAsPending(createIngredient('stable-key'), 'pendingCreate');
    const remote = createIngredient('stable-key', { id: 'server-id' });
    const first = await syncIngredientSnapshot({ localIngredients: [local], remoteIngredients: [remote] });
    const second = await syncIngredientSnapshot({ localIngredients: first.nextSnapshot, remoteIngredients: [remote] });

    expect(first.nextSnapshot).toHaveLength(1);
    expect(second.nextSnapshot).toHaveLength(1);
    expect(second.pendingUploads).toEqual([]);
    expect(second.nextSnapshot[0]).toMatchObject({ id: 'server-id', clientId: 'stable-key', syncState: 'clean' });
  });
});
