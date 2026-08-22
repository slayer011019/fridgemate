import { useEffect, useRef } from 'react';
import { getAdSenseConfig, isValidAdSenseSlot } from '../../utils/adsenseConfig';

const scriptPromises = new Map();

function loadAdSenseScript(client) {
  if (scriptPromises.has(client)) {
    return scriptPromises.get(client);
  }

  const existingScript = document.querySelector(`script[data-adsense-client="${client}"]`);

  if (existingScript) {
    return Promise.resolve();
  }

  const scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.adsenseClient = client;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', () => reject(new Error('AdSense script failed to load.')), { once: true });
    document.head.appendChild(script);
  });

  scriptPromises.set(client, scriptPromise);
  return scriptPromise;
}

function AdSenseSlot({ placement }) {
  const initializedRef = useRef(false);
  const config = getAdSenseConfig();
  const slot = config.slots[placement];
  const visible = config.enabled && isValidAdSenseSlot(slot);

  useEffect(() => {
    if (!visible || initializedRef.current) return;

    let cancelled = false;

    loadAdSenseScript(config.client)
      .then(() => {
        if (cancelled || initializedRef.current) return;

        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
        initializedRef.current = true;
      })
      .catch((error) => {
        console.warn(`AdSense slot initialization failed: ${error.message}`);
      });

    return () => {
      cancelled = true;
    };
  }, [config.client, visible]);

  if (!visible) return null;

  return (
    <aside className="ad-slot" aria-label="광고">
      <span className="ad-slot-label">광고</span>
      <ins
        className="adsbygoogle block min-h-[100px] w-full"
        data-ad-client={config.client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}

export default AdSenseSlot;
