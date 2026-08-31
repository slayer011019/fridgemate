function readJwtRole(value) {
  const parts = String(value || '').split('.');
  if (parts.length !== 3) return null;

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

function resolveReadOnlySupabaseKey(env = process.env) {
  const anonKey = String(env.SUPABASE_ANON_KEY || '').trim();
  if (!anonKey) {
    throw new Error('SUPABASE_ANON_KEY is required for public read-only recipe queries.');
  }

  if (anonKey.startsWith('sb_secret_') || readJwtRole(anonKey) === 'service_role') {
    throw new Error('SUPABASE_ANON_KEY must not contain service-role credentials.');
  }

  return anonKey;
}

export { resolveReadOnlySupabaseKey };
