'use client';

/**
 * Barrie's four-light scan strip: Agree, Heads-up, Fragile, Stand down.
 *
 * Not a signal engine, not a trade recommendation, and not a change to Gamma
 * Weather. Four relationships the Weather fields already carry, surfaced as one
 * row so "does this moment match a relationship I trust?" is a glance instead
 * of five chips compared in your head.
 *
 * The rules are NOT here. They live in src/analytics/scan_lights.py and arrive
 * on the payload, because the base-rate report grades the rules the panel runs
 * and a second implementation in TypeScript would drift from the one being
 * graded. This file decides nothing; it renders four booleans.
 *
 * Colour: lit is --color-scan-lit, which is deliberately not the site's
 * directional green. A bullish green beside a light called Fragile would say
 * something the strip must never say, and the spec rules out red and
 * directional colours outright. Dim is a text token rather than a hue, so an
 * unmet rule recedes instead of reading as a second state.
 *
 * Identity is carried by the LABEL, not the colour. Every pill is named, which
 * is what makes a green near the Stable bid teal harmless here and what keeps
 * the row readable with no colour vision at all.
 */

export interface ScanLights {
  agree: boolean;
  heads_up: boolean;
  fragile: boolean;
  stand_down: boolean;
}

/**
 * Hover wording. Each says what the light means and, where it matters, what it
 * does NOT mean, because every one of these has an obvious wrong reading.
 */
const LIGHTS: { key: keyof ScanLights; label: string; title: string }[] = [
  {
    key: 'agree',
    label: 'Agree',
    title:
      'Lean, Stability and Gamma trend are all telling the same structural story, on a cushion that is not already thin. The book agrees with itself. That is not a trade.',
  },
  {
    key: 'heads_up',
    label: 'Heads-up',
    title:
      'Confirmed pressure is pressing against a book that still looks secure. Do not casually fade a level because structure appears to contain price. Over 42 sessions this condition was no more likely to extend than anything else, so it is a reason to look again rather than a reason to expect a break.',
  },
  {
    key: 'fragile',
    label: 'Fragile',
    title:
      'Either the flip cushion is thin and closing, or the book is accelerative and thinning at once. The level may not behave reliably. Not a directional call.',
  },
  {
    key: 'stand_down',
    label: 'Stand down',
    title:
      'Mixed, or no two of Lean, Stability and Gamma trend agreeing at all. The structural picture is not coherent enough for a clean read. A two-of-three read lights neither this nor Agree, and is worth a closer look at the chips and the chart.',
  },
];

export default function ScanLightStrip({ lights }: { lights?: ScanLights | null }) {
  // Nothing rather than four dim pills: a strip of all-dim lights on a payload
  // that never carried them reads as "every rule failed", which is a different
  // statement from "this build does not serve them yet".
  if (!lights) return null;

  return (
    <div
      className="mt-3 flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Scan lights"
    >
      {LIGHTS.map(({ key, label, title }) => {
        const on = Boolean(lights[key]);
        return (
          <span
            key={key}
            title={title}
            // aria-disabled would be wrong: an unlit rule is not unavailable,
            // it is answered and the answer is no. The pressed state says that.
            role="status"
            aria-label={`${label}: ${on ? 'yes' : 'no'}`}
            className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors"
            style={{
              borderColor: on ? 'var(--color-scan-lit)' : 'var(--color-border)',
              backgroundColor: on ? 'var(--color-scan-lit-soft)' : 'transparent',
              color: on ? 'var(--color-scan-lit)' : 'var(--color-text-secondary)',
            }}
          >
            {/* The dot carries the on/off state a second time, so the row is
                readable in greyscale, in forced colours, and to anyone who
                cannot separate the lit green from the text grey. */}
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: on ? 'var(--color-scan-lit)' : 'transparent',
                boxShadow: on ? undefined : 'inset 0 0 0 1px var(--color-text-secondary)',
              }}
            />
            {label}
          </span>
        );
      })}
    </div>
  );
}
