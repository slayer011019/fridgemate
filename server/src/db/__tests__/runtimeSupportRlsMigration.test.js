import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = resolve(
  process.cwd(),
  'prisma/migrations/20260825023000_scope_runtime_support_tables/migration.sql'
);

describe('runtime support RLS migration', () => {
  it('scopes accounts and sessions to request-derived database context', async () => {
    const sql = await readFile(MIGRATION_PATH, 'utf8');

    expect(sql).toContain("current_setting('app.current_user_id', true)");
    expect(sql).toContain("current_setting('app.current_auth_email', true)");
    expect(sql).toContain("current_setting('app.current_refresh_token_hash', true)");
    expect(sql).toContain('REVOKE DELETE ON TABLE "User", "AuthSession"');
    expect(sql).toContain('ALTER TABLE "User" FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE "AuthSession" FORCE ROW LEVEL SECURITY');
    expect(sql).not.toContain('ON "User"\n  FOR SELECT\n  TO fridgemate_app\n  USING (true)');
    expect(sql).not.toContain('ON "AuthSession"\n  FOR SELECT\n  TO fridgemate_app\n  USING (true)');
  });
});
