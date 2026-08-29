import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createRecipeEmbeddingCheckpoint,
  parseCheckpointArgs
} from '../checkpoint-recipe-embeddings.js';

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

function createPrismaClient() {
  return {
    $queryRawUnsafe: vi.fn(async (sql) =>
      sql.includes('GROUP BY embedding_model')
        ? [{ embedding_model: 'test-model', embedding_dimensions: 3, count: 1 }]
        : [
            {
              id: '11111111-1111-4111-8111-111111111111',
              recipe_id: '22222222-2222-4222-8222-222222222222',
              embedding_text: '검색재료: 감자',
              embedding: '[0.1,0.2,0.3]',
              embedding_model: 'test-model',
              embedding_dimensions: 3,
              content_hash: 'abc123',
              created_at: new Date('2026-08-29T00:00:00.000Z'),
              updated_at: new Date('2026-08-29T00:00:00.000Z')
            }
          ]
    )
  };
}

describe('recipe embedding checkpoint', () => {
  it('parses a write-free preflight and output options', () => {
    expect(
      parseCheckpointArgs(['--dry-run', '--output-dir=.local/checkpoints', '--label=before stale'])
    ).toEqual({
      dryRun: true,
      outputDir: '.local/checkpoints',
      label: 'before stale'
    });
  });

  it('returns aggregate-only data during dry-run', async () => {
    const result = await createRecipeEmbeddingCheckpoint({
      dryRun: true,
      prismaClient: createPrismaClient()
    });

    expect(result).toEqual({
      rowCount: 1,
      groups: [{ embeddingModel: 'test-model', embeddingDimensions: 3, count: 1 }],
      productionWrites: 0,
      dryRun: true
    });
  });

  it('writes and verifies a compressed checkpoint with a vector-free manifest', async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), 'fridgemate-embedding-checkpoint-'));
    temporaryDirectories.push(outputDir);

    const result = await createRecipeEmbeddingCheckpoint({
      outputDir,
      label: 'before-staged-backfill',
      now: new Date('2026-08-29T01:02:03.456Z'),
      prismaClient: createPrismaClient()
    });

    expect(result).toMatchObject({
      rowCount: 1,
      verified: true,
      containsRawVectors: true,
      productionWrites: 0
    });
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    const manifestText = await readFile(result.manifestPath, 'utf8');
    const manifest = JSON.parse(manifestText);
    expect(manifest).not.toHaveProperty('embedding');
    expect(manifest.sha256).toBe(result.sha256);

    const checkpoint = gunzipSync(await readFile(result.checkpointPath)).toString('utf8');
    const row = JSON.parse(checkpoint.trim());
    expect(row.embedding).toBe('[0.1,0.2,0.3]');
    expect(path.basename(result.checkpointPath)).toContain('before-staged-backfill');
  });
});
