import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  document.head.querySelectorAll('script[data-adsense]').forEach((s) => s.remove());
});

describe('AdSense', () => {
  it('renders nothing and loads no script when ads are not configured', async () => {
    vi.stubEnv('VITE_ADSENSE_CLIENT', '');
    vi.stubEnv('VITE_ADSENSE_SLOT', '');
    const { default: AdSense, adsEnabled } = await import('./AdSense');
    const { container } = render(<AdSense />);
    expect(adsEnabled).toBe(false);
    expect(container).toBeEmptyDOMElement();
    expect(document.querySelector('script[data-adsense]')).toBeNull();
  });

  it('loads the script once and renders the configured unit', async () => {
    vi.stubEnv('VITE_ADSENSE_CLIENT', 'ca-pub-123');
    vi.stubEnv('VITE_ADSENSE_SLOT', '456');
    const { default: AdSense } = await import('./AdSense');
    const { container } = render(
      <>
        <AdSense />
        <AdSense />
      </>,
    );
    const unit = container.querySelector('ins.adsbygoogle');
    expect(unit).toHaveAttribute('data-ad-client', 'ca-pub-123');
    expect(unit).toHaveAttribute('data-ad-slot', '456');
    expect(document.querySelectorAll('script[data-adsense]')).toHaveLength(1);
  });
});
