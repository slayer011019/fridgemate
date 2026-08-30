import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const transaction = {
  $queryRaw: vi.fn()
};
const prismaMock = {
  $transaction: vi.fn(async (operation) => operation(transaction))
};

vi.mock('../prisma.js', () => ({ prisma: prismaMock }));

const NON_TENANT_RLS_TABLE_NAMES = new Set([
  // Public, read-only catalog tables have no userId column. The staging table is
  // also not granted to the application role.
  'recipes',
  'recipe_ingredients',
  'raw_recipes'
]);

function getMigrationRlsTableNames() {
  const migrationsRoot = resolve(process.cwd(), 'prisma/migrations');
  const migrationSql = readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(migrationsRoot, entry.name, 'migration.sql'))
    .filter((migrationPath) => existsSync(migrationPath))
    .map((migrationPath) => readFileSync(migrationPath, 'utf8'))
    .join('\n');
  const enabledRlsTables = new Set();
  const enableRlsPattern =
    /ALTER TABLE\s+(?:(?:public\.)?"([^"]+)"|(?:public\.)?([a-z_][a-z0-9_]*))\s+ENABLE ROW LEVEL SECURITY/gi;

  for (const match of migrationSql.matchAll(enableRlsPattern)) {
    const tableName = match[1] || match[2];

    if (!NON_TENANT_RLS_TABLE_NAMES.has(tableName)) {
      enabledRlsTables.add(tableName);
    }
  }

  return [...enabledRlsTables].sort();
}

function getSchemaTenantModelNames() {
  const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
  const tenantModels = ['User'];
  const modelPattern = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;

  for (const match of schema.matchAll(modelPattern)) {
    if (/^\s+userId\s+/m.test(match[2])) {
      tenantModels.push(match[1]);
    }
  }

  return [...new Set(tenantModels)].sort();
}

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

  it('keeps the ownership guard synchronized with tenant models and RLS migrations', async () => {
    const { TENANT_RLS_TABLE_NAMES } = await import('../tenantScope.js');
    const guardedTableNames = [...TENANT_RLS_TABLE_NAMES].sort();

    expect(guardedTableNames).toEqual(getSchemaTenantModelNames());
    expect(guardedTableNames).toEqual(getMigrationRlsTableNames());
  });
});
