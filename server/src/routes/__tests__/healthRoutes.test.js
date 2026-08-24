import { describe, expect, it, vi } from 'vitest';
import { getHealth } from '../healthRoutes.js';

describe('healthRoutes', () => {
  it('returns only a public liveness signal without database state', () => {
    const response = { json: vi.fn() };

    getHealth({}, response);

    expect(response.json).toHaveBeenCalledWith({ status: 'ok' });
  });
});
