'use client';

// Loads the X (Twitter) Ads base pixel once on mount. Rendered from the root
// layout so it runs on every route — mirrors TelemetryProvider. No-op unless
// NEXT_PUBLIC_TWITTER_PIXEL_ID is set (guarded inside twitter-client).

import { useEffect } from 'react';
import { initTwitterPixel } from '@/core/telemetry/twitter-client';

export default function TwitterPixelProvider() {
  useEffect(() => {
    initTwitterPixel();
  }, []);

  return null;
}
