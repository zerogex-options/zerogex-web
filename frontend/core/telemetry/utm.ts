'use client';

// Reads the four standard UTM parameters off the current URL so paid-traffic
// funnel events can be attributed to the campaign that drove the visit. Returns
// only the keys that are actually present, so events stay clean (no empty
// values) for organic visitors who arrive without a campaign string.
//
// Deliberately dependency-free and SSR-safe: callers spread the result into the
// properties bag of a telemetry event, e.g.
//   capture(TelemetryEvent.TrialCtaClick, { location, symbol, ...readUtmParams() });
//
// PostHog also records first-touch UTM as person properties automatically; this
// helper makes the campaign visible on the specific click/landing events too,
// which is what the paid funnel dashboards group by.

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;

export function readUtmParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const params = new URLSearchParams(window.location.search);
    const out: Record<string, string> = {};
    for (const key of UTM_KEYS) {
      const value = params.get(key);
      if (value) out[key] = value;
    }
    return out;
  } catch {
    // A malformed query string must never break a CTA click.
    return {};
  }
}
