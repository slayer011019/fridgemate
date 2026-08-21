import { useEffect, useRef } from 'react';
import { getAdSenseConfig, isValidAdSenseSlot } from '../../utils/adsenseConfig';

function AdSenseSlot({ placement }) {
  const initializedRef = useRef(false);
  const config = getAdSenseConfig();
  const slot = config.slots[placement];
  const visible = config.enabled && isValidAdSenseSlot(slot);

  useEffect(() => {
    if (!visible || initializedRef.current) return;

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
      initializedRef.current = true;
    } catch (error) {
      console.warn(`AdSense slot initialization failed: ${error.message}`);
    }
  }, [visible]);

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
