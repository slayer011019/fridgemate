import { existsSync } from 'node:fs';
import { lstat, readdir, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseSupabaseProjectUrl } from './supabaseWriteGuard.js';

const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/u;
const DIRECT_HOST_PATTERN = /^db\.([a-z0-9]{20})\.supabase\.co$/u;
const SESSION_POOLER_HOST_PATTERN = /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/u;

function getSingleArgumentValue(args, prefix) {
  const values = args.filter((arg) => arg.startsWith(prefix));
  if (values.length > 1) {
    throw new Error(`${prefix.slice(0, -1)} must be provided at most once.`);
  }

  if (values.length === 0) return null;
  const value = values[0].slice(prefix.length).trim();
  if (!value) throw new Error(`${prefix.slice(0, -1)} requires a value.`);
  return value;
}

function parseBackupPreflightArgs(args = []) {
  const supported = args.every(
    (arg) =>
      arg === '--confirm-encrypted-storage' ||
      arg.startsWith('--output-dir=') ||
      arg.startsWith('--confirm-database-host=')
  );
  if (!supported) {
    throw new Error(
      'Supported options are --output-dir, --confirm-database-host, and --confirm-encrypted-storage.'
    );
  }

  const encryptedConfirmations = args.filter((arg) => arg === '--confirm-encrypted-storage');
  if (encryptedConfirmations.length > 1) {
    throw new Error('--confirm-encrypted-storage must be provided at most once.');
  }

  return {
    confirmDatabaseHost:
      getSingleArgumentValue(args, '--confirm-database-host=')?.toLowerCase() || null,
    encryptedStorageConfirmed: encryptedConfirmations.length === 1,
    outputDirectory: getSingleArgumentValue(args, '--output-dir=')
  };
}

function parseSupabaseDatabaseUrl(rawValue) {
  let url;
  try {
    url = new URL(String(rawValue || '').trim());
  } catch {
    throw new Error('The backup database URL must be a valid PostgreSQL URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('The backup database URL must use the postgres or postgresql protocol.');
  }
  if (!url.username || !url.password || !url.hostname || !url.pathname.replace(/^\/+|\/+$/gu, '')) {
    throw new Error('The backup database URL must include user, password, host, and database.');
  }
  if (url.hash) {
    throw new Error('The backup database URL must not contain a fragment.');
  }

  const connectionOptions = [...url.searchParams.entries()].map(([key, value]) => [
    key.toLowerCase(),
    value.toLowerCase()
  ]);
  const transactionPoolerRequested = connectionOptions.some(
    ([key, value]) => key === 'pgbouncer' && value === 'true'
  );
  const unsafeTlsRequested = connectionOptions.some(
    ([key, value]) =>
      key === 'sslmode' && !['require', 'verify-ca', 'verify-full'].includes(value)
  );
  const port = url.port || '5432';
  if (port !== '5432' || transactionPoolerRequested) {
    throw new Error(
      'Logical backups require the direct or session-pooler connection on port 5432, not a transaction pooler.'
    );
  }
  if (unsafeTlsRequested) {
    throw new Error('The backup database URL must not disable or downgrade TLS verification.');
  }

  const host = url.hostname.toLowerCase();
  const directMatch = DIRECT_HOST_PATTERN.exec(host);
  let projectRef;
  let connectionMode;

  if (directMatch) {
    projectRef = directMatch[1];
    connectionMode = 'direct';
  } else if (SESSION_POOLER_HOST_PATTERN.test(host)) {
    const username = decodeURIComponent(url.username);
    const poolerMatch = /^postgres\.([a-z0-9]{20})$/u.exec(username);
    if (!poolerMatch) {
      throw new Error(
        'A Supabase session-pooler backup URL must use the postgres.<project-ref> username.'
      );
    }
    projectRef = poolerMatch[1];
    connectionMode = 'session-pooler';
  } else {
    throw new Error('The backup database URL must target a canonical Supabase database host.');
  }

  if (!PROJECT_REF_PATTERN.test(projectRef)) {
    throw new Error('The backup database URL does not contain a valid Supabase project ref.');
  }

  return { connectionMode, host, port: Number(port), projectRef };
}

function resolveBackupDatabaseTarget(env = process.env) {
  const source = env.BACKUP_DATABASE_URL ? 'BACKUP_DATABASE_URL' : 'DIRECT_URL';
  const rawUrl = env[source];
  if (!rawUrl) {
    throw new Error('BACKUP_DATABASE_URL or DIRECT_URL is required. Runtime DATABASE_URL is not accepted.');
  }

  const database = parseSupabaseDatabaseUrl(rawUrl);
  const apiProject = parseSupabaseProjectUrl(env.SUPABASE_URL);
  if (database.projectRef !== apiProject.projectRef) {
    throw new Error('The database URL project ref must exactly match SUPABASE_URL.');
  }

  return { ...database, source };
}

function isWithinRoot(rootPath, targetPath) {
  const relativePath = relative(rootPath, targetPath);
  return (
    relativePath === '' ||
    (relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath))
  );
}

async function validateBackupOutputDirectory(rawPath, { workspaceRoot = process.cwd() } = {}) {
  if (!rawPath || !isAbsolute(rawPath)) {
    throw new Error('--output-dir must be an existing absolute directory outside the repository.');
  }

  const resolvedOutput = resolve(rawPath);
  const outputInfo = await lstat(resolvedOutput).catch(() => null);
  if (!outputInfo || !outputInfo.isDirectory() || outputInfo.isSymbolicLink()) {
    throw new Error('--output-dir must be an existing real directory, not a symlink or junction.');
  }

  const [canonicalWorkspace, canonicalOutput] = await Promise.all([
    realpath(resolve(workspaceRoot)),
    realpath(resolvedOutput)
  ]);
  if (isWithinRoot(canonicalWorkspace, canonicalOutput)) {
    throw new Error('Database backups must be written outside the repository.');
  }

  let ancestor = canonicalOutput;
  while (true) {
    const gitMarker = await lstat(join(ancestor, '.git')).catch(() => null);
    if (gitMarker) {
      throw new Error('Database backups must not be written inside any Git worktree.');
    }
    const parent = dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }

  const entries = await readdir(canonicalOutput);
  if (entries.length > 0) {
    throw new Error('--output-dir must be a dedicated empty directory to prevent overwrites.');
  }

  // Preserve the operator-provided absolute spelling (for example `/var` on
  // macOS, whose canonical path is `/private/var`) after validating the real
  // directory. The canonical path is still used for every containment check.
  return resolvedOutput;
}

function sanitizeProbeEnvironment(env = process.env) {
  return Object.fromEntries(
    Object.entries(env).filter(
      ([key]) =>
        !/(?:DATABASE_URL|DIRECT_URL|PASSWORD|SECRET|TOKEN|API[_-]?KEY|PRIVATE[_-]?KEY|SERVICE_ROLE)/iu.test(
          key
        )
    )
  );
}

function commandExists(
  command,
  { env = process.env, platform = process.platform, spawn = spawnSync } = {}
) {
  const locator = platform === 'win32' ? 'where.exe' : 'which';
  const result = spawn(locator, [command], {
    env: sanitizeProbeEnvironment(env),
    shell: false,
    stdio: 'ignore',
    windowsHide: true
  });
  return result.status === 0;
}

function commandSucceeds(command, args, { env = process.env, spawn = spawnSync } = {}) {
  const result = spawn(command, args, {
    env: sanitizeProbeEnvironment(env),
    shell: false,
    stdio: 'ignore',
    timeout: 10_000,
    windowsHide: true
  });
  return result.status === 0;
}

function detectBackupTools({
  fileExists = existsSync,
  env = process.env,
  platform = process.platform,
  spawn = spawnSync,
  workspaceRoot = process.cwd()
} = {}) {
  const localSupabaseBinary = join(
    workspaceRoot,
    'node_modules',
    '.bin',
    platform === 'win32' ? 'supabase.cmd' : 'supabase'
  );
  const hasLocalSupabase = fileExists(localSupabaseBinary);
  const hasGlobalSupabase = commandExists('supabase', { env, platform, spawn });
  const supabaseCommand = hasLocalSupabase
    ? localSupabaseBinary
    : hasGlobalSupabase
      ? 'supabase'
      : null;
  const dockerInstalled = commandExists('docker', { env, platform, spawn });

  return {
    dockerInstalled,
    dockerRunning:
      dockerInstalled &&
      commandSucceeds('docker', ['info', '--format', '{{.ServerVersion}}'], { env, spawn }),
    supabaseCliAvailable:
      Boolean(supabaseCommand) &&
      commandSucceeds(supabaseCommand, ['--version'], { env, spawn }),
    supabaseCliSource: hasLocalSupabase ? 'local' : hasGlobalSupabase ? 'global' : null
  };
}

async function runBackupPreflight({
  args = process.argv.slice(2),
  detectTools = detectBackupTools,
  env = process.env,
  workspaceRoot = process.cwd()
} = {}) {
  const options = parseBackupPreflightArgs(args);
  if (!options.encryptedStorageConfirmed) {
    throw new Error(
      '--confirm-encrypted-storage is required because a logical dump contains personal data.'
    );
  }

  const database = resolveBackupDatabaseTarget(env);
  if (!options.confirmDatabaseHost || options.confirmDatabaseHost !== database.host) {
    throw new Error(
      `The exact target requires --confirm-database-host=${database.host}. No database URL was printed.`
    );
  }

  const outputDirectory = await validateBackupOutputDirectory(options.outputDirectory, {
    workspaceRoot
  });
  const tools = await detectTools({ env, workspaceRoot });
  const problems = [];
  if (!tools.supabaseCliAvailable) problems.push('Supabase CLI is not installed and runnable.');
  if (!tools.dockerInstalled) problems.push('Docker is not installed.');
  else if (!tools.dockerRunning) problems.push('Docker is installed but its engine is not running.');

  return {
    database,
    encryptedStorageConfirmed: true,
    outputDirectory,
    problems,
    ready: problems.length === 0,
    tools
  };
}

function formatBackupPreflightReport(result) {
  const lines = [
    `[backup:preflight] ready=${result.ready}`,
    `[backup:preflight] database=${result.database.host}:${result.database.port} (${result.database.connectionMode}, ${result.database.source})`,
    `[backup:preflight] output=${result.outputDirectory}`,
    `[backup:preflight] encryptedStorageConfirmed=${result.encryptedStorageConfirmed}`,
    `[backup:preflight] supabaseCli=${result.tools.supabaseCliAvailable ? result.tools.supabaseCliSource : 'missing'}`,
    `[backup:preflight] docker=${result.tools.dockerRunning ? 'running' : result.tools.dockerInstalled ? 'not-running' : 'missing'}`
  ];
  for (const problem of result.problems) lines.push(`[backup:preflight] problem=${problem}`);
  return lines.join('\n');
}

export {
  detectBackupTools,
  formatBackupPreflightReport,
  parseBackupPreflightArgs,
  parseSupabaseDatabaseUrl,
  resolveBackupDatabaseTarget,
  runBackupPreflight,
  sanitizeProbeEnvironment,
  validateBackupOutputDirectory
};
