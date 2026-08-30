import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = resolve(
  process.cwd(),
  'prisma/migrations/20260830200000_harden_supabase_advisor_functions/migration.sql'
);
const RECIPE_SQL_PATH = resolve(process.cwd(), 'docs/sql/create_recipes_table.sql');
const VERIFICATION_SQL_PATH = resolve(
  process.cwd(),
  'docs/sql/verify_supabase_security_advisor_hardening.sql'
);

describe('Supabase Security Advisor function hardening migration', () => {
  it('hardens the recipe timestamp trigger without assuming it exists or is owned by the migration role', async () => {
    const sql = await readFile(MIGRATION_PATH, 'utf8');

    expect(sql).toContain("target_proc.proname = 'set_recipes_updated_at'");
    expect(sql).toContain("pg_catalog.pg_has_role(current_user, function_owner, 'USAGE')");
    expect(sql).toMatch(/RAISE\s+EXCEPTION\s+'public\.set_recipes_updated_at/iu);
    expect(sql).toContain('SECURITY INVOKER');
    expect(sql).toContain('SET search_path = pg_catalog');
    expect(sql).toContain('NEW.updated_at = pg_catalog.now()');
    expect(sql).toContain(
      'REVOKE EXECUTE ON FUNCTION public.set_recipes_updated_at() FROM PUBLIC'
    );
    expect(sql).toContain("ARRAY['anon', 'authenticated']");
  });

  it('only revokes callable access from the expected managed event-trigger function', async () => {
    const sql = await readFile(MIGRATION_PATH, 'utf8');

    expect(sql).toContain("target_proc.proname = 'rls_auto_enable'");
    expect(sql).toContain("target_proc.prorettype = 'pg_catalog.event_trigger'::pg_catalog.regtype");
    expect(sql).toContain('AND target_proc.prosecdef');
    expect(sql).toContain(
      'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC'
    );
    expect(sql).toMatch(/RAISE\s+EXCEPTION\s+'public\.rls_auto_enable/iu);
    expect(sql).not.toContain('CREATE OR REPLACE FUNCTION public.rls_auto_enable');
    expect(sql).not.toContain('ALTER FUNCTION public.rls_auto_enable');
  });

  it('keeps the recipe SQL source of truth hardened and leaves vector relocation manual', async () => {
    const [migrationSql, recipeSql, verificationSql] = await Promise.all([
      readFile(MIGRATION_PATH, 'utf8'),
      readFile(RECIPE_SQL_PATH, 'utf8'),
      readFile(VERIFICATION_SQL_PATH, 'utf8')
    ]);

    expect(recipeSql).toContain('set search_path = pg_catalog');
    expect(recipeSql).toContain('new.updated_at = pg_catalog.now()');
    expect(recipeSql).toContain(
      'revoke execute on function public.set_recipes_updated_at() from public'
    );
    const executableMigrationSql = migrationSql.replace(/^\s*--.*$/gm, '');

    expect(executableMigrationSql).not.toMatch(/ALTER\s+EXTENSION\s+vector\s+SET\s+SCHEMA\s+/i);
    expect(verificationSql).toContain("where target_extension.extname = 'vector'");
    expect(verificationSql).toContain("column_type.typname = 'vector'");
  });
});
