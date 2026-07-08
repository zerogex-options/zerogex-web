'use client';

import { useEffect } from 'react';
import { capture } from '@/core/telemetry/posthog-client';
import { TelemetryEvent } from '@/core/telemetry/events';
import { readUtmParams } from '@/core/telemetry/utm';

// Renders nothing — its only job is to mark the top of the paid-traffic funnel.
// Mounted once on each free gamma-levels page so a paid visit is recorded with
// the primary symbol and whatever UTM campaign string drove it. This is
// distinct from the automatic $pageview (TelemetryProvider) so the paid funnel
// has a dedicated, symbol-tagged entry event to build cohorts on.
export default function PaidFunnelAnalytics({ symbol }: { symbol: string }) {
  useEffect(() => {
    capture(TelemetryEvent.PaidLandingView, { symbol, ...readUtmParams() });
    // Fire once per mount; symbol is stable for the life of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
