'use client';

// Global analytics bootstrap: initializes PostHog once and captures a pageview
// on every client-side route change. Rendered from the root layout so it runs
// on all routes — including the standalone funnel pages (/, /pricing,
// /register) that ClientLayout renders without app chrome. No-op unless a
// PostHog key is configured (guarded inside posthog-client).
//
// User identification lives in ClientLayout instead, which already holds the
// auth session — keeping it there avoids a second /api/auth/session fetch.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { initAnalytics, capturePageview } from '@/core/telemetry/posthog-client';

export default function TelemetryProvider() {
  const pathname = usePathname();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (pathname) capturePageview(pathname);
  }, [pathname]);

  return null;
}
