import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = resolve(
  process.cwd(),
  'prisma/migrations/20260825020000_enable_tenant_rls/migration.sql'
);

describe('tenant RLS migration', () => {
  it('forces user policies on sensitive tenant tables with a non-bypass role', async () => {
    const sql = await readFile(MIGRATION_PATH, 'utf8');

    expect(sql).toContain('CREATE ROLE fridgemate_app');
    expect(sql).toContain('NOBYPASSRLS');
    expect(sql).toContain('ALTER TABLE "Ingredient" FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE "ImportCorrection" FORCE ROW LEVEL SECURITY');
    expect(sql).toContain("current_setting('app.current_user_id', true)");
    expect(sql.match(/WITH CHECK/g)).toHaveLength(2);
  });
});
