import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  formatBackupPreflightReport,
  parseBackupPreflightArgs,
  parseSupabaseDatabaseUrl,
  runBackupPreflight,
  sanitizeProbeEnvironment,
  validateBackupOutputDirectory
} from '../lib/backupPreflight.js';

const PROJECT_REF = 'abcdefghijklmnopqrst';
const API_URL = `https://${PROJECT_REF}.supabase.co`;
const SESSION_HOST = 'aws-1-ap-northeast-1.pooler.supabase.com';
const sandboxes = [];

async function createSandbox() {
  const sandbox = await mkdtemp(join(tmpdir(), 'fridgemate-backup-preflight-'));
  sandboxes.push(sandbox);
  return sandbox;
}

afterEach(async () => {
  await Promise.all(sandboxes.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

describe('backup prerequisite guard', () => {
  it('accepts only direct or session-pooler Supabase URLs on port 5432', () => {
    expect(
      parseSupabaseDatabaseUrl(
        `postgresql://postgres:secret@db.${PROJECT_REF}.supabase.co:5432/postgres`
      )
    ).toEqual({
      connectionMode: 'direct',
      host: `db.${PROJECT_REF}.supabase.co`,
      port: 5432,
      projectRef: PROJECT_REF
    });
    expect(
      parseSupabaseDatabaseUrl(
        `postgresql://postgres.${PROJECT_REF}:secret@${SESSION_HOST}:5432/postgres?sslmode=require`
      )
    ).toEqual({
      connectionMode: 'session-pooler',
      host: SESSION_HOST,
      port: 5432,
      projectRef: PROJECT_REF
    });

    expect(() =>
      parseSupabaseDatabaseUrl(
        `postgresql://postgres.${PROJECT_REF}:secret@${SESSION_HOST}:6543/postgres`
      )
    ).toThrow(/transaction pooler/iu);
    expect(() =>
      parseSupabaseDatabaseUrl(
        `postgresql://postgres.${PROJECT_REF}:secret@${SESSION_HOST}:5432/postgres?pgbouncer=true`
      )
    ).toThrow(/transaction pooler/iu);
    expect(() =>
      parseSupabaseDatabaseUrl(
        `postgresql://postgres.${PROJECT_REF}:secret@${SESSION_HOST}:5432/postgres?sslmode=disable`
      )
    ).toThrow(/TLS/iu);
    expect(() =>
      parseSupabaseDatabaseUrl('postgresql://postgres:secret@database.example.test:5432/postgres')
    ).toThrow(/canonical Supabase/iu);
  });

  it('requires unambiguous encrypted-output and exact-host arguments', () => {
    expect(
      parseBackupPreflightArgs([
        '--output-dir=C:\\encrypted-backup',
        `--confirm-database-host=${SESSION_HOST.toUpperCase()}`,
        '--confirm-encrypted-storage'
      ])
    ).toEqual({
      confirmDatabaseHost: SESSION_HOST,
      encryptedStorageConfirmed: true,
      outputDirectory: 'C:\\encrypted-backup'
    });
    expect(() => parseBackupPreflightArgs(['--execute'])).toThrow(/Supported options/iu);
    expect(() =>
      parseBackupPreflightArgs(['--output-dir=one', '--output-dir=two'])
    ).toThrow(/at most once/iu);
  });

  it('allows only a dedicated empty real directory outside the repository', async () => {
    const sandbox = await createSandbox();
    const workspaceRoot = join(sandbox, 'workspace');
    const inside = join(workspaceRoot, 'backup');
    const outside = join(sandbox, 'encrypted-output');
    await Promise.all([
      mkdir(inside, { recursive: true }),
      mkdir(outside, { recursive: true })
    ]);

    await expect(
      validateBackupOutputDirectory(inside, { workspaceRoot })
    ).rejects.toThrow(/outside the repository/iu);
    await expect(
      validateBackupOutputDirectory(outside, { workspaceRoot })
    ).resolves.toBe(outside);

    await writeFile(join(outside, 'existing.txt'), 'occupied', 'utf8');
    await expect(
      validateBackupOutputDirectory(outside, { workspaceRoot })
    ).rejects.toThrow(/dedicated empty directory/iu);
  });

  it('never includes the database password or URL in its report', async () => {
    const sandbox = await createSandbox();
    const workspaceRoot = join(sandbox, 'workspace');
    const outputDirectory = join(sandbox, 'encrypted-output');
    await Promise.all([
      mkdir(workspaceRoot, { recursive: true }),
      mkdir(outputDirectory, { recursive: true })
    ]);
    const secret = 'never-print-this-password';
    const result = await runBackupPreflight({
      args: [
        `--output-dir=${outputDirectory}`,
        `--confirm-database-host=${SESSION_HOST}`,
        '--confirm-encrypted-storage'
      ],
      detectTools: () => ({
        dockerInstalled: true,
        dockerRunning: true,
        supabaseCliAvailable: true,
        supabaseCliSource: 'local'
      }),
      env: {
        DIRECT_URL: `postgresql://postgres.${PROJECT_REF}:${secret}@${SESSION_HOST}:5432/postgres`,
        SUPABASE_URL: API_URL
      },
      workspaceRoot
    });
    const report = formatBackupPreflightReport(result);

    expect(result.ready).toBe(true);
    expect(report).toContain(SESSION_HOST);
    expect(report).not.toContain(secret);
    expect(report).not.toContain('postgresql://');
  });

  it('fails readiness when the required local tools are unavailable', async () => {
    const sandbox = await createSandbox();
    const workspaceRoot = join(sandbox, 'workspace');
    const outputDirectory = join(sandbox, 'encrypted-output');
    await Promise.all([
      mkdir(workspaceRoot, { recursive: true }),
      mkdir(outputDirectory, { recursive: true })
    ]);
    const result = await runBackupPreflight({
      args: [
        `--output-dir=${outputDirectory}`,
        `--confirm-database-host=${SESSION_HOST}`,
        '--confirm-encrypted-storage'
      ],
      detectTools: () => ({
        dockerInstalled: false,
        dockerRunning: false,
        supabaseCliAvailable: false,
        supabaseCliSource: null
      }),
      env: {
        DIRECT_URL: `postgresql://postgres.${PROJECT_REF}:secret@${SESSION_HOST}:5432/postgres`,
        SUPABASE_URL: API_URL
      },
      workspaceRoot
    });

    expect(result.ready).toBe(false);
    expect(result.problems).toHaveLength(2);
  });

  it('removes database and provider secrets from every tool-probe environment', () => {
    expect(
      sanitizeProbeEnvironment({
        BACKUP_DATABASE_URL: 'postgresql://secret',
        DIRECT_URL: 'postgresql://secret',
        PATH: 'safe-path',
        SUPABASE_SERVICE_ROLE_KEY: 'secret',
        USERPROFILE: 'safe-profile'
      })
    ).toEqual({ PATH: 'safe-path', USERPROFILE: 'safe-profile' });
  });
});
