import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';
import { describe, expect, it } from 'vitest';

const RESERVED_DUMP_NAMES = new Set([
  'data.sql',
  'history_data.sql',
  'history_schema.sql',
  'roles.sql',
  'schema.sql'
]);
const DUMP_EXTENSION_PATTERN = /(?:\.backup|\.dump(?:\.(?:gz|zst))?|\.sql\.(?:gz|zst))$/iu;

describe('tracked database backup policy', () => {
  it('keeps plaintext and compressed logical backup artifacts out of Git', () => {
    const trackedFiles = execFileSync('git', ['ls-files', '-z'], {
      encoding: 'utf8',
      shell: false,
      windowsHide: true
    })
      .split('\0')
      .filter(Boolean);
    const trackedBackups = trackedFiles.filter((path) => {
      const fileName = basename(path).toLowerCase();
      return RESERVED_DUMP_NAMES.has(fileName) || DUMP_EXTENSION_PATTERN.test(fileName);
    });

    expect(trackedBackups).toEqual([]);
  });
});
