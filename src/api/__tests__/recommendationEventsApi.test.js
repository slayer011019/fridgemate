import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestJsonMock } = vi.hoisted(() => ({
  requestJsonMock: vi.fn()
}));

vi.mock('../apiClient', () => ({
  ApiClientError: class ApiClientError extends Error {},
  requestJson: requestJsonMock
}));

vi.mock('../../utils/backendConfig', () => ({
  isBackendEnabled: () => true
}));

vi.mock('../../utils/analytics', () => ({
  getAnalyticsSessionId: () => 'test-session'
}));

import { saveRecommendationEvent } from '../recommendationEventsApi';

describe('recommendationEventsApi', () => {
  beforeEach(() => {
    requestJsonMock.mockReset();
  });

  it('sends recommendation events sequentially to avoid connection bursts', async () => {
    let resolveFirstRequest;
    requestJsonMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstRequest = resolve;
          })
      )
      .mockResolvedValueOnce({ id: 'event-2' });

    const firstRequest = saveRecommendationEvent({ id: 'recipe-1' }, 'impression');
    const secondRequest = saveRecommendationEvent({ id: 'recipe-2' }, 'impression');

    await vi.waitFor(() => expect(requestJsonMock).toHaveBeenCalledTimes(1));
    resolveFirstRequest({ id: 'event-1' });
    await firstRequest;
    await vi.waitFor(() => expect(requestJsonMock).toHaveBeenCalledTimes(2));
    await secondRequest;
  });
});
