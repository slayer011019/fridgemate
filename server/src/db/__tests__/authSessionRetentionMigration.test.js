import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = resolve(
  process.cwd(),
  'prisma/migrations/20260830170000_bound_auth_session_history/migration.sql'
);

describe('auth session retention migration', () => {
  it('permits only tenant-scoped session cleanup for the runtime role', async () => {
    const sql = await readFile(MIGRATION_PATH, 'utf8');

    expect(sql).toContain('GRANT DELETE ON TABLE "AuthSession" TO fridgemate_app');
    expect(sql).toContain('CREATE POLICY fridgemate_app_auth_session_delete');
    expect(sql).toContain('ON "AuthSession"\n  FOR DELETE\n  TO fridgemate_app');
    expect(sql).toContain('"userId" = NULLIF(current_setting(\'app.current_user_id\', true), \'\')');
    expect(sql).toContain('WHERE NOT is_active OR state_rank <= 8');
    expect(sql).toContain('WHERE history_rank > 24');
    expect(sql).toContain('DELETE FROM "AuthSession"');
    expect(sql).not.toContain('USING (true)');
  });
});
