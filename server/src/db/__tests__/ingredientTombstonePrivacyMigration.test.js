import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260830190000_prepare_ingredient_tombstone_scrubbing/migration.sql'
);

describe('Ingredient tombstone privacy prepare migration', () => {
  it('makes every business payload column nullable without touching existing rows', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    for (const column of ['name', 'category', 'storageType', 'quantity', 'consumed', 'createdAt']) {
      expect(sql).toContain(`ALTER COLUMN "${column}" DROP NOT NULL`);
    }
    expect(sql).not.toMatch(/\bUPDATE\s+"Ingredient"/iu);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\s+"Ingredient"/iu);
  });

  it('validates that active rows still have all formerly required fields', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    expect(sql).toContain('ADD CONSTRAINT "Ingredient_active_payload_required"');
    expect(sql).toContain('"deletedAt" IS NOT NULL');
    for (const column of ['name', 'category', 'storageType', 'quantity', 'consumed', 'createdAt']) {
      expect(sql).toContain(`"${column}" IS NOT NULL`);
    }
    expect(sql).toContain('VALIDATE CONSTRAINT "Ingredient_active_payload_required"');
  });
});
