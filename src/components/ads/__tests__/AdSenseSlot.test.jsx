import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import AdSenseSlot from '../AdSenseSlot';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  document.head.querySelectorAll('script[data-adsense-client]').forEach((script) => script.remove());
});

describe('AdSenseSlot', () => {
  it('does not request the AdSense script while serving is disabled', () => {
    vi.stubEnv('VITE_ADSENSE_VERIFICATION_ENABLED', 'true');
    vi.stubEnv('VITE_ADSENSE_SERVING_ENABLED', 'false');
    vi.stubEnv('VITE_ADSENSE_CLIENT', 'ca-pub-1234567890123456');
    vi.stubEnv('VITE_ADSENSE_HOME_SLOT', '1234567890');

    const { container } = render(<AdSenseSlot placement="home" />);

    expect(container).toBeEmptyDOMElement();
    expect(document.head.querySelector('script[data-adsense-client]')).toBeNull();
  });

  it('loads the script only for an enabled manual slot', async () => {
    vi.stubEnv('VITE_ADSENSE_VERIFICATION_ENABLED', 'true');
    vi.stubEnv('VITE_ADSENSE_SERVING_ENABLED', 'true');
    vi.stubEnv('VITE_ADSENSE_CLIENT', 'ca-pub-1234567890123457');
    vi.stubEnv('VITE_ADSENSE_HOME_SLOT', '1234567890');

    render(<AdSenseSlot placement="home" />);

    await waitFor(() => {
      expect(document.head.querySelector('script[data-adsense-client="ca-pub-1234567890123457"]')).not.toBeNull();
    });
  });
});
