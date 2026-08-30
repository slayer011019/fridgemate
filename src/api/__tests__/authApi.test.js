import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportUserData, logout } from '../authApi.js';

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

  it('requires a current password in a state-changing export request', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ schemaVersion: 2 })
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(exportUserData('StrongPassphrase123!')).resolves.toEqual({ schemaVersion: 2 });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/data-export$/),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ password: 'StrongPassphrase123!' })
      })
    );
  });
});
