import { describe, expect, it } from 'vitest';
import { getAdSenseConfig, isValidAdSenseClient, isValidAdSenseSlot } from '../adsenseConfig';

describe('adsenseConfig', () => {
  it('keeps verification and ad serving disabled until explicitly configured', () => {
    const disabled = getAdSenseConfig({ VITE_ADSENSE_VERIFICATION_ENABLED: 'false' });
    const invalid = getAdSenseConfig({
      VITE_ADSENSE_VERIFICATION_ENABLED: 'true',
      VITE_ADSENSE_CLIENT: 'invalid'
    });

    expect(disabled.verificationEnabled).toBe(false);
    expect(disabled.enabled).toBe(false);
    expect(invalid.verificationEnabled).toBe(false);
    expect(invalid.enabled).toBe(false);
  });

  it('can verify ownership without serving ads during policy review', () => {
    const config = getAdSenseConfig({
      VITE_ADSENSE_VERIFICATION_ENABLED: 'true',
      VITE_ADSENSE_SERVING_ENABLED: 'false',
      VITE_ADSENSE_CLIENT: 'ca-pub-1234567890123456',
      VITE_ADSENSE_HOME_SLOT: '1234567890'
    });

    expect(config.verificationEnabled).toBe(true);
    expect(config.enabled).toBe(false);
  });

  it('serves ads only when verification and serving are both enabled', () => {
    const config = getAdSenseConfig({
      VITE_ADSENSE_VERIFICATION_ENABLED: 'true',
      VITE_ADSENSE_SERVING_ENABLED: 'true',
      VITE_ADSENSE_CLIENT: 'ca-pub-1234567890123456',
      VITE_ADSENSE_HOME_SLOT: '1234567890'
    });

    expect(config.verificationEnabled).toBe(true);
    expect(config.enabled).toBe(true);
    expect(isValidAdSenseClient(config.client)).toBe(true);
    expect(isValidAdSenseSlot(config.slots.home)).toBe(true);
    expect(isValidAdSenseSlot('slot-name')).toBe(false);
  });
});
