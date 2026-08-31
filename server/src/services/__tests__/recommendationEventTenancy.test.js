import { beforeEach, describe, expect, it, vi } from 'vitest';

const { database, scopeMock } = vi.hoisted(() => ({
  database: {
    user: { findUnique: vi.fn() },
    recipe: { findUnique: vi.fn() },
    recommendationEvent: {
      create: vi.fn(),
      findUnique: vi.fn()
    }
  },
  scopeMock: vi.fn()
}));

vi.mock('../../db/tenantScope.js', () => ({
  withUserDatabaseScope: (userId, operation) => {
    scopeMock(userId);
    return operation(database);
  }
}));

import { createRecommendationEvent } from '../recommendationEventService.js';

const PAYLOAD = {
  eventType: 'impression',
  recipeId: 'local:recipe-1',
  clientEventId: 'event-1234-abcd',
  sessionId: 'fm-1234-abcd',
  source: 'rule'
};

describe('recommendation event tenant idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.user.findUnique.mockResolvedValue({ id: 'user-1' });
    database.recipe.findUnique.mockResolvedValue(null);
  });

  it('always writes the authenticated user id inside that tenant scope', async () => {
    database.recommendationEvent.create.mockResolvedValue({
      id: 'recommendation-event-1',
      userId: 'user-1'
    });

    await createRecommendationEvent({ userId: 'user-1', body: PAYLOAD });

    expect(scopeMock).toHaveBeenCalledWith('user-1');
    expect(database.recommendationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user-1' })
    });
  });

  it('resolves duplicate ids only within the authenticated user composite key', async () => {
    database.recommendationEvent.create.mockRejectedValue({ code: 'P2002' });
    database.recommendationEvent.findUnique.mockResolvedValue({
      id: 'recommendation-event-1',
      userId: 'user-1',
      clientEventId: PAYLOAD.clientEventId,
      createdAt: new Date('2026-08-30T00:00:00.000Z')
    });

    const result = await createRecommendationEvent({ userId: 'user-1', body: PAYLOAD });

    expect(database.recommendationEvent.findUnique).toHaveBeenCalledWith({
      where: {
        userId_clientEventId: {
          userId: 'user-1',
          clientEventId: PAYLOAD.clientEventId
        }
      }
    });
    expect(result.id).toBe('recommendation-event-1');
  });
});
