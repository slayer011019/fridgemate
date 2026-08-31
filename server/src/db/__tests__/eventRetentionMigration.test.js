import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATHS = [
  'prisma/migrations/20260830180000_bound_event_retention/migration.sql',
  'prisma/migrations/20260830181000_add_product_event_retention_index/migration.sql',
  'prisma/migrations/20260830182000_drop_legacy_recommendation_event_index/migration.sql'
].map((path) => resolve(process.cwd(), path));

function executableStatements(sql) {
  return sql
    .replace(/^\s*--.*$/gmu, '')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

describe('event retention migration', () => {
  it('adds stable server-created-time indexes without deleting or reassigning event rows', async () => {
    const [recommendationIndexSql, productIndexSql, legacyIndexSql] = await Promise.all(
      MIGRATION_PATHS.map((path) => readFile(path, 'utf8'))
    );
    const sql = [recommendationIndexSql, productIndexSql, legacyIndexSql].join('\n');

    expect(sql).toContain('"RecommendationEvent"("createdAt", "id")');
    expect(sql).toContain('"ProductEvent"("createdAt", "id")');
    expect(recommendationIndexSql).toContain('CREATE INDEX CONCURRENTLY');
    expect(productIndexSql).toContain('CREATE INDEX CONCURRENTLY');
    expect(legacyIndexSql).toContain('DROP INDEX CONCURRENTLY IF EXISTS');
    for (const migrationSql of [recommendationIndexSql, productIndexSql, legacyIndexSql]) {
      expect(executableStatements(migrationSql)).toHaveLength(1);
      expect(migrationSql).not.toMatch(/\bBEGIN\b|\bCOMMIT\b/iu);
    }
    expect(sql).not.toContain('"occurredAt", "id"');
    expect(sql).not.toMatch(/DELETE\s+FROM/iu);
    expect(sql).not.toMatch(/SET\s+NOT\s+NULL/iu);
    expect(sql).not.toMatch(/ALTER\s+COLUMN\s+"userId"/iu);
  });
});
