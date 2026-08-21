import { describe, expect, it } from 'vitest';
import { getAdSenseConfig, isValidAdSenseClient, isValidAdSenseSlot } from '../adsenseConfig';

describe('adsenseConfig', () => {
  it('stays disabled until both the flag and a valid client are present', () => {
    expect(getAdSenseConfig({ VITE_ADSENSE_ENABLED: 'false' }).enabled).toBe(false);
    expect(getAdSenseConfig({ VITE_ADSENSE_ENABLED: 'true', VITE_ADSENSE_CLIENT: 'invalid' }).enabled).toBe(false);
  });

  it('enables valid publisher and slot values', () => {
    const config = getAdSenseConfig({
      VITE_ADSENSE_ENABLED: 'true',
      VITE_ADSENSE_CLIENT: 'ca-pub-1234567890123456',
      VITE_ADSENSE_HOME_SLOT: '1234567890'
    });

    expect(config.enabled).toBe(true);
    expect(isValidAdSenseClient(config.client)).toBe(true);
    expect(isValidAdSenseSlot(config.slots.home)).toBe(true);
    expect(isValidAdSenseSlot('slot-name')).toBe(false);
  });
});
