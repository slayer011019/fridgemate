import { describe, expect, it, vi } from 'vitest';

const transaction = {
  $queryRaw: vi.fn()
};
const prismaMock = {
  $transaction: vi.fn(async (operation) => operation(transaction))
};

vi.mock('../prisma.js', () => ({ prisma: prismaMock }));

describe('tenant database scope', () => {
  it('sets a transaction-local user ID before running tenant queries', async () => {
    transaction.$queryRaw.mockResolvedValue([{ set_config: 'user-1' }]);
    const operation = vi.fn(async (database) => database);
    const { withUserDatabaseScope } = await import('../tenantScope.js');

    await expect(withUserDatabaseScope('user-1', operation)).resolves.toBe(transaction);

    expect(transaction.$queryRaw).toHaveBeenCalledOnce();
    expect(operation).toHaveBeenCalledWith(transaction);
    expect(transaction.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      operation.mock.invocationCallOrder[0]
    );
  });

  it('rejects an empty tenant scope before opening a transaction', async () => {
    const { withUserDatabaseScope } = await import('../tenantScope.js');

    await expect(withUserDatabaseScope('', vi.fn())).rejects.toThrow('user ID is required');
  });

  it('fails closed for a production owner or BYPASSRLS connection', async () => {
    const { assertSafeTenantDatabaseContext } = await import('../tenantScope.js');

    expect(() =>
      assertSafeTenantDatabaseContext(
        { isAppRoleMember: true, bypassRls: true, ownsTenantTables: false },
        { production: true }
      )
    ).toThrow('NOBYPASSRLS');
    expect(() =>
      assertSafeTenantDatabaseContext(
        { isAppRoleMember: true, bypassRls: false, ownsTenantTables: true },
        { production: true }
      )
    ).toThrow('non-owner');
  });

  it('accepts a production non-owner member of the application role', async () => {
    const { assertSafeTenantDatabaseContext } = await import('../tenantScope.js');

    expect(() =>
      assertSafeTenantDatabaseContext(
        { isAppRoleMember: true, bypassRls: false, ownsTenantTables: false },
        { production: true }
      )
    ).not.toThrow();
  });
});
