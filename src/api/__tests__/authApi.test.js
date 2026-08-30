import { afterEach, describe, expect, it, vi } from 'vitest';
import { logout } from '../authApi.js';

describe('authApi logout', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not refresh the session when logout returns 401', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      headers: new Headers(),
      json: async () => ({ message: 'Authentication is required.' })
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(logout()).rejects.toMatchObject({
      status: 401,
      path: '/auth/logout'
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/auth\/logout$/);
  });
});
