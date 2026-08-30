const SUPABASE_PROJECT_HOST_SUFFIX = '.supabase.co';
const SUPABASE_PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;

function parseWriteIntent(argv = []) {
  const execute = argv.includes('--execute');
  const explicitDryRun = argv.includes('--dry-run');
  const confirmationArgs = argv.filter((arg) => arg.startsWith('--confirm-project-ref='));

  if (execute && explicitDryRun) {
    throw new Error('--execute and --dry-run cannot be used together.');
  }

  if (confirmationArgs.length > 1) {
    throw new Error('--confirm-project-ref must be provided at most once.');
  }

  const confirmProjectRef = confirmationArgs.length === 1
    ? confirmationArgs[0].slice('--confirm-project-ref='.length)
    : null;

  if (confirmProjectRef !== null && !SUPABASE_PROJECT_REF_PATTERN.test(confirmProjectRef)) {
    throw new Error('--confirm-project-ref must be an exact 20-character lowercase Supabase project ref.');
  }

  return {
    confirmProjectRef,
    execute,
    isDryRun: !execute
  };
}

function parseSupabaseProjectUrl(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl || '').trim());
  } catch {
    throw new Error('SUPABASE_URL must be a valid URL.');
  }

  const path = url.pathname.replace(/\/+$/, '');
  const hostname = url.hostname.toLowerCase();
  const projectRef = hostname.endsWith(SUPABASE_PROJECT_HOST_SUFFIX)
    ? hostname.slice(0, -SUPABASE_PROJECT_HOST_SUFFIX.length)
    : '';

  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    (path && path !== '/rest/v1') ||
    !SUPABASE_PROJECT_REF_PATTERN.test(projectRef)
  ) {
    throw new Error(
      'Writes require SUPABASE_URL to use the canonical https://<project-ref>.supabase.co URL.'
    );
  }

  return {
    projectRef,
    supabaseUrl: url.origin
  };
}

function requireConfirmedSupabaseWrite({ confirmProjectRef, execute, supabaseUrl }) {
  if (!execute) {
    throw new Error('Database writes require the explicit --execute flag.');
  }

  const target = parseSupabaseProjectUrl(supabaseUrl);
  if (!confirmProjectRef || confirmProjectRef !== target.projectRef) {
    throw new Error(
      'Database writes require --confirm-project-ref to exactly match the project ref in SUPABASE_URL.'
    );
  }

  return target;
}

export {
  parseSupabaseProjectUrl,
  parseWriteIntent,
  requireConfirmedSupabaseWrite
};
