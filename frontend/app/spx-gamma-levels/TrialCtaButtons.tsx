'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { CSSProperties } from 'react';
import { capture } from '@/core/telemetry/posthog-client';
import { TelemetryEvent, type TelemetryEventName } from '@/core/telemetry/events';
import { readUtmParams } from '@/core/telemetry/utm';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './TrialCtaButtons.i18n';

// Shared, analytics-instrumented CTA buttons for the paid-traffic conversion
// blocks on the free gamma-levels pages. Centralizing them keeps the trial
// destination, the button styling, and the funnel-event wiring identical across
// the top conversion block, the dashboard preview, the footer CTA, and the
// sticky bar — edited in exactly one place.

// New accounts land on /pricing after /register (RegisterClient's default
// successHref), where a plan choice starts the 7-day Stripe trial. So the trial
// CTA points at /register; the card is collected at checkout, not here.
const TRIAL_HREF = '/register';
const PRICING_HREF = '/pricing';

const primaryStyle: CSSProperties = {
  padding: '12px 22px',
  fontSize: 14,
};

const secondaryStyle: CSSProperties = {
  padding: '12px 22px',
  fontSize: 14,
};

export function TrialButton({
  label,
  location,
  symbol,
  event = TelemetryEvent.TrialCtaClick,
  style,
  showArrow = true,
}: {
  label?: string;
  /** Which surface fired this click, e.g. "paid_landing_hero". */
  location: string;
  symbol: string;
  /** Override the event name (the dashboard preview fires its own event). */
  event?: TelemetryEventName;
  style?: CSSProperties;
  showArrow?: boolean;
}) {
  const t = usePageT(dict);
  const resolvedLabel = label ?? t('startTrial');
  return (
    <Link
      href={TRIAL_HREF}
      onClick={() => capture(event, { location, symbol, ...readUtmParams() })}
      style={{ ...primaryStyle, ...style }}
      className="zg-btn zg-btn--primary"
    >
      {resolvedLabel} {showArrow && <ArrowRight size={16} />}
    </Link>
  );
}

export function ComparePlansButton({
  label,
  location,
  symbol,
  style,
}: {
  label?: string;
  location: string;
  symbol: string;
  style?: CSSProperties;
}) {
  const t = usePageT(dict);
  const resolvedLabel = label ?? t('comparePlans');
  return (
    <Link
      href={PRICING_HREF}
      onClick={() => capture(TelemetryEvent.ComparePlansClick, { location, symbol, ...readUtmParams() })}
      style={{ ...secondaryStyle, ...style }}
      className="zg-btn zg-btn--secondary"
    >
      {resolvedLabel}
    </Link>
  );
}
