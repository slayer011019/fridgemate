import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPaths = [
  'prisma/migrations/20260830190000_prepare_ingredient_tombstone_scrubbing/migration.sql',
  'prisma/migrations/20260830191000_validate_ingredient_active_payload/migration.sql',
  'prisma/migrations/20260830192000_allow_scrubbed_ingredient_tombstones/migration.sql'
].map((path) => resolve(process.cwd(), path));

describe('Ingredient tombstone privacy prepare migration', () => {
  it('makes every business payload column nullable without touching existing rows', async () => {
    const [constraintSql, validationSql, nullableSql] = await Promise.all(
      migrationPaths.map((path) => readFile(path, 'utf8'))
    );
    const sql = [constraintSql, validationSql, nullableSql].join('\n');

    for (const column of ['name', 'category', 'storageType', 'quantity', 'consumed', 'createdAt']) {
      expect(nullableSql).toContain(`ALTER COLUMN "${column}" DROP NOT NULL`);
    }
    expect(constraintSql).not.toMatch(/DROP\s+NOT\s+NULL/iu);
    expect(validationSql).not.toMatch(/DROP\s+NOT\s+NULL/iu);
    expect(nullableSql).toContain("SET lock_timeout = '5s'");
    expect(nullableSql).toContain("SET statement_timeout = '30s'");
    expect(sql).not.toMatch(/\bUPDATE\s+"Ingredient"/iu);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\s+"Ingredient"/iu);
  });

  it('validates that active rows still have all formerly required fields', async () => {
    const [constraintSql, validationSql] = await Promise.all(
      migrationPaths.slice(0, 2).map((path) => readFile(path, 'utf8'))
    );

    expect(constraintSql).toContain('ADD CONSTRAINT "Ingredient_active_payload_required"');
    expect(constraintSql).toContain('NOT VALID');
    expect(constraintSql).not.toContain('VALIDATE CONSTRAINT');
    expect(constraintSql).toContain('"deletedAt" IS NOT NULL');
    for (const column of ['name', 'category', 'storageType', 'quantity', 'consumed', 'createdAt']) {
      expect(constraintSql).toContain(`"${column}" IS NOT NULL`);
    }
    expect(validationSql).toContain('VALIDATE CONSTRAINT "Ingredient_active_payload_required"');
    expect(validationSql).toContain("SET lock_timeout = '5s'");
    expect(validationSql).toContain("SET statement_timeout = '30s'");
  });
});
