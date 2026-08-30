import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createMany, scopeMock } = vi.hoisted(() => ({
  createMany: vi.fn(),
  scopeMock: vi.fn()
}));

vi.mock('../../db/tenantScope.js', () => ({
  withUserDatabaseScope: (userId, callback) => {
    scopeMock(userId);
    return callback({ productEvent: { createMany } });
  }
}));

import {
  createProductEvent,
  normalizeProductEvent,
  normalizeProductEventRoute
} from '../productEventService.js';

const validPayload = {
  clientEventId: 'event-1234',
  eventName: 'recommendation_clicked',
  route: '/recipes',
  properties: {
    device_type: 'desktop',
    network_state: 'online',
    screen: 'recipes',
    group: 'local',
    score: 75,
    missing_core_count: 1
  },
  occurredAt: new Date().toISOString()
};

describe('productEventService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts only the documented event and property shape', () => {
    expect(normalizeProductEvent(validPayload)).toMatchObject({
      clientEventId: 'event-1234',
      eventName: 'recommendation_clicked'
    });
    expect(() =>
      normalizeProductEvent({ ...validPayload, eventName: 'attacker_event' })
    ).toThrow('eventName is not supported.');
    expect(() =>
      normalizeProductEvent({ ...validPayload, properties: { label: 'private@example.com' } })
    ).toThrow('properties contains an unsupported key.');
    expect(() =>
      normalizeProductEvent({
        ...validPayload,
        properties: { ...validPayload.properties, device_type: 'private@example.com' }
      })
    ).toThrow('properties.device_type is invalid.');
  });

  it('replaces dynamic and unknown routes with non-identifying templates', () => {
    expect(normalizeProductEventRoute('/ingredients/private-record-id/edit?from=home')).toBe(
      '/ingredients/:id/edit'
    );
    expect(normalizeProductEventRoute('/private/person@example.com')).toBe('/other');
  });

  it('uses the authenticated user scope and treats a repeated client id as a duplicate', async () => {
    createMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    await expect(createProductEvent({ userId: 'user-a', body: validPayload })).resolves.toMatchObject({ created: true });
    await expect(createProductEvent({ userId: 'user-a', body: validPayload })).resolves.toMatchObject({ duplicate: true });
    expect(scopeMock).toHaveBeenCalledTimes(2);
    expect(scopeMock).toHaveBeenCalledWith('user-a');
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
  });

  it('rejects anonymous writes', async () => {
    await expect(createProductEvent({ body: validPayload })).rejects.toMatchObject({ status: 401 });
    expect(scopeMock).not.toHaveBeenCalled();
  });
});
