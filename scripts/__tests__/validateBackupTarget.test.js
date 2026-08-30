import { describe, expect, it, vi } from 'vitest';
import { runFromEnvironment, validateBackupTarget } from '../validateBackupTarget.js';

const PROJECT_REF = 'zninmnfyanyqjaipbyzx';

describe('validateBackupTarget', () => {
  it('accepts the pinned session-pooler owner connection without returning credentials', () => {
    const result = validateBackupTarget(
      `postgresql://postgres.${PROJECT_REF}:secret@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require`,
      PROJECT_REF
    );

    expect(result).toEqual({
      connectionMode: 'session-pooler',
      host: 'aws-1-ap-northeast-1.pooler.supabase.com',
      projectRef: PROJECT_REF
    });
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('accepts a canonical direct owner connection', () => {
    expect(
      validateBackupTarget(
        `postgresql://postgres:secret@db.${PROJECT_REF}.supabase.co:5432/postgres?sslmode=verify-full`,
        PROJECT_REF
      ).connectionMode
    ).toBe('direct');
  });

  it.each([
    ['missing TLS', `postgresql://postgres:secret@db.${PROJECT_REF}.supabase.co/postgres`],
    [
      'transaction pooler',
      `postgresql://postgres.${PROJECT_REF}:secret@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true`
    ],
    [
      'duplicate TLS override',
      `postgresql://postgres:secret@db.${PROJECT_REF}.supabase.co/postgres?sslmode=require&sslmode=disable`
    ],
    [
      'query host override',
      `postgresql://postgres:secret@db.${PROJECT_REF}.supabase.co/postgres?sslmode=require&host=example.com`
    ],
    [
      'non-owner role',
      `postgresql://fridgemate_runtime:secret@db.${PROJECT_REF}.supabase.co/postgres?sslmode=require`
    ],
    [
      'wrong project',
      'postgresql://postgres.aaaaaaaaaaaaaaaaaaaa:secret@aws-1-ap-northeast-1.pooler.supabase.com/postgres?sslmode=require'
    ],
    [
      'non-Supabase host',
      'postgresql://postgres:secret@example.com/postgres?sslmode=require'
    ]
  ])('rejects %s', (_label, url) => {
    expect(() => validateBackupTarget(url, PROJECT_REF)).toThrow();
  });

  it('logs only the sanitized target summary', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const secret = 'do-not-print-this';

    runFromEnvironment({
      BACKUP_DATABASE_URL: `postgresql://postgres.${PROJECT_REF}:${secret}@aws-1-ap-northeast-1.pooler.supabase.com/postgres?sslmode=require`,
      EXPECTED_SUPABASE_PROJECT_REF: PROJECT_REF
    });

    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls.flat().join(' ')).not.toContain(secret);
    log.mockRestore();
  });
});
