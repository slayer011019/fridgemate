import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = resolve(
  process.cwd(),
  'prisma/migrations/20260830180000_bound_event_retention/migration.sql'
);

describe('event retention migration', () => {
  it('adds stable server-created-time indexes without deleting or reassigning event rows', async () => {
    const sql = await readFile(MIGRATION_PATH, 'utf8');

    expect(sql).toContain('"RecommendationEvent"("createdAt", "id")');
    expect(sql).toContain('"ProductEvent"("createdAt", "id")');
    expect(sql).not.toContain('"occurredAt", "id"');
    expect(sql).not.toMatch(/DELETE\s+FROM/iu);
    expect(sql).not.toMatch(/SET\s+NOT\s+NULL/iu);
    expect(sql).not.toMatch(/ALTER\s+COLUMN\s+"userId"/iu);
  });
});
