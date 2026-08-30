import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/u;
const DIRECT_HOST_PATTERN = /^db\.([a-z0-9]{20})\.supabase\.co$/u;
const SESSION_POOLER_HOST_PATTERN = /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/u;
const SAFE_SSL_MODES = new Set(['require', 'verify-ca', 'verify-full']);

function validateBackupTarget(rawUrl, expectedProjectRef) {
  if (!PROJECT_REF_PATTERN.test(String(expectedProjectRef || ''))) {
    throw new Error('EXPECTED_SUPABASE_PROJECT_REF must be an exact project ref.');
  }

  let url;
  try {
    url = new URL(String(rawUrl || '').trim());
  } catch {
    throw new Error('BACKUP_DATABASE_URL must be a valid PostgreSQL URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('BACKUP_DATABASE_URL must use the postgres or postgresql protocol.');
  }
  if (!url.username || !url.password || url.pathname.replace(/^\/+|\/+$/gu, '') !== 'postgres') {
    throw new Error('BACKUP_DATABASE_URL must include the owner, password, and postgres database.');
  }
  if (url.hash) throw new Error('BACKUP_DATABASE_URL must not contain a fragment.');
  if ((url.port || '5432') !== '5432') {
    throw new Error('Backups require the direct or session-pooler endpoint on port 5432.');
  }
  if (url.searchParams.get('pgbouncer')?.toLowerCase() === 'true') {
    throw new Error('Transaction-pooler mode is not valid for logical backups.');
  }
  if (!SAFE_SSL_MODES.has(url.searchParams.get('sslmode')?.toLowerCase())) {
    throw new Error('BACKUP_DATABASE_URL must explicitly require TLS with sslmode.');
  }

  const host = url.hostname.toLowerCase();
  const username = decodeURIComponent(url.username);
  const directMatch = DIRECT_HOST_PATTERN.exec(host);
  let projectRef;
  let connectionMode;

  if (directMatch) {
    projectRef = directMatch[1];
    connectionMode = 'direct';
    if (username !== 'postgres') {
      throw new Error('The direct backup connection must use the Supabase postgres owner.');
    }
  } else if (SESSION_POOLER_HOST_PATTERN.test(host)) {
    const ownerMatch = /^postgres\.([a-z0-9]{20})$/u.exec(username);
    if (!ownerMatch) {
      throw new Error('The session-pooler backup connection must use the Supabase postgres owner.');
    }
    projectRef = ownerMatch[1];
    connectionMode = 'session-pooler';
  } else {
    throw new Error('BACKUP_DATABASE_URL must target a canonical Supabase database host.');
  }

  if (projectRef !== expectedProjectRef) {
    throw new Error('Backup target does not match the pinned production project.');
  }

  return { connectionMode, host, projectRef };
}

function runFromEnvironment(env = process.env) {
  const target = validateBackupTarget(
    env.BACKUP_DATABASE_URL,
    env.EXPECTED_SUPABASE_PROJECT_REF
  );
  console.log(
    `Validated ${target.connectionMode} backup target for project ${target.projectRef}.`
  );
  return target;
}

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMainModule) {
  try {
    runFromEnvironment();
  } catch (error) {
    console.error(`[database-backup] ${error instanceof Error ? error.message : 'Validation failed.'}`);
    process.exitCode = 1;
  }
}

export { runFromEnvironment, validateBackupTarget };
