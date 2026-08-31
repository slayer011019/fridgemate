function bytesToUuid(bytes) {
  const hexadecimal = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

  return [
    hexadecimal.slice(0, 8),
    hexadecimal.slice(8, 12),
    hexadecimal.slice(12, 16),
    hexadecimal.slice(16, 20),
    hexadecimal.slice(20)
  ].join('-');
}

/**
 * Creates an identifier only when a cryptographically secure browser/runtime
 * source is available. Callers can then fail closed instead of silently
 * falling back to predictable timestamps or Math.random().
 */
export function createSecureId(prefix = '') {
  const cryptoApi = globalThis.crypto;
  let identifier = '';

  try {
    if (typeof cryptoApi?.randomUUID === 'function') {
      identifier = cryptoApi.randomUUID();
    } else if (typeof cryptoApi?.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      cryptoApi.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      identifier = bytesToUuid(bytes);
    }
  } catch {
    return null;
  }

  if (!identifier) return null;
  return prefix ? `${prefix}-${identifier}` : identifier;
}
