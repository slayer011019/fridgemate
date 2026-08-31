import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSecureId } from '../secureId';

describe('createSecureId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses randomUUID when the runtime provides it', () => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => '11111111-1111-4111-8111-111111111111')
    });

    expect(createSecureId('event')).toBe('event-11111111-1111-4111-8111-111111111111');
  });

  it('builds an RFC 4122 version 4 id from getRandomValues', () => {
    vi.stubGlobal('crypto', {
      getRandomValues(bytes) {
        bytes.fill(0xab);
        return bytes;
      }
    });

    expect(createSecureId('fm')).toBe('fm-abababab-abab-4bab-abab-abababababab');
  });

  it('fails closed when secure randomness is unavailable', () => {
    vi.stubGlobal('crypto', undefined);

    expect(createSecureId()).toBeNull();
  });

  it('fails closed when the runtime random source throws', () => {
    vi.stubGlobal('crypto', {
      getRandomValues() {
        throw new Error('random source unavailable');
      }
    });

    expect(createSecureId()).toBeNull();
  });
});
