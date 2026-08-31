import { describe, expect, it } from 'vitest';
import {
  parseSupabaseProjectUrl,
  parseWriteIntent,
  requireConfirmedSupabaseWrite
} from '../lib/supabaseWriteGuard.js';

const PROJECT_REF = 'abcdefghijklmnopqrst';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

describe('Supabase operational write guard', () => {
  it('keeps scripts in dry-run mode unless --execute is explicit', () => {
    expect(parseWriteIntent([])).toEqual({
      confirmProjectRef: null,
      execute: false,
      isDryRun: true
    });
    expect(parseWriteIntent(['--dry-run'])).toMatchObject({ execute: false, isDryRun: true });
    expect(parseWriteIntent(['--execute', `--confirm-project-ref=${PROJECT_REF}`])).toEqual({
      confirmProjectRef: PROJECT_REF,
      execute: true,
      isDryRun: false
    });
    expect(() => parseWriteIntent(['--execute', '--dry-run'])).toThrow(/cannot be used together/i);
  });

  it('extracts a project ref only from canonical HTTPS Supabase URLs', () => {
    expect(parseSupabaseProjectUrl(`${SUPABASE_URL}/rest/v1/`)).toEqual({
      projectRef: PROJECT_REF,
      supabaseUrl: SUPABASE_URL
    });
    expect(() => parseSupabaseProjectUrl(`http://${PROJECT_REF}.supabase.co`)).toThrow(/canonical/i);
    expect(() => parseSupabaseProjectUrl('https://database.example.com')).toThrow(/canonical/i);
    expect(() => parseSupabaseProjectUrl(`${SUPABASE_URL}/unexpected`)).toThrow(/canonical/i);
  });

  it('requires both explicit execution and an exact project-ref confirmation', () => {
    expect(
      requireConfirmedSupabaseWrite({
        confirmProjectRef: PROJECT_REF,
        execute: true,
        supabaseUrl: SUPABASE_URL
      })
    ).toEqual({ projectRef: PROJECT_REF, supabaseUrl: SUPABASE_URL });

    expect(() =>
      requireConfirmedSupabaseWrite({
        confirmProjectRef: PROJECT_REF,
        execute: false,
        supabaseUrl: SUPABASE_URL
      })
    ).toThrow(/--execute/i);
    expect(() =>
      requireConfirmedSupabaseWrite({
        confirmProjectRef: null,
        execute: true,
        supabaseUrl: SUPABASE_URL
      })
    ).toThrow(/exactly match/i);
    expect(() =>
      requireConfirmedSupabaseWrite({
        confirmProjectRef: 'tsrqponmlkjihgfedcba',
        execute: true,
        supabaseUrl: SUPABASE_URL
      })
    ).toThrow(/exactly match/i);
  });
});
