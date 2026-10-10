import React, { useEffect, useRef } from 'react';

/** Google AdSense publisher and ad unit ids. Ads are off unless both are configured at build time. */
const AD_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;
const AD_SLOT = import.meta.env.VITE_ADSENSE_SLOT as string | undefined;

export const adsEnabled = Boolean(AD_CLIENT && AD_SLOT);

type AdsWindow = Window & { adsbygoogle?: unknown[] };

const loadScript = () => {
  if (document.querySelector('script[data-adsense]')) return;
  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.dataset.adsense = 'true';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(AD_CLIENT ?? '')}`;
  document.head.appendChild(script);
};

interface AdSenseProps {
  adFormat?: 'auto' | 'fluid' | 'rectangle' | 'horizontal';
  style?: React.CSSProperties;
  className?: string;
}

/** An ad unit; renders nothing when ads are not configured. */
const AdSense: React.FC<AdSenseProps> = ({ adFormat = 'auto', style = {}, className = '' }) => {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!adsEnabled || !adRef.current) return;
    try {
      loadScript();
      const w = window as AdsWindow;
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch (error) {
      console.error('Error loading AdSense ad:', error);
    }
  }, []);

  if (!adsEnabled) return null;

  return (
    <div className={`adsense-container ${className}`} ref={adRef}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', textAlign: 'center', ...style }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={AD_SLOT}
        data-ad-format={adFormat}
        data-full-width-responsive="true"
      />
    </div>
  );
};

export default AdSense;
