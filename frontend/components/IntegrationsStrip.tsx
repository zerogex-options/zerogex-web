import Link from 'next/link';
import { ArrowRight, RefreshCw, PencilLine } from 'lucide-react';
import {
  INTEGRATIONS,
  INTEGRATIONS_HUB,
  otherIntegrations,
  type IntegrationId,
} from '@/core/integrations';

// "The other ones might suit you better" — shown at the foot of each
// integration landing, and under the two big sections on the gamma-levels
// pages.
//
// This replaces IndicatorCrossLink, which was a hand-written pairwise block:
// each of the two landings carried a paragraph about the other one. That is
// two links to maintain at two platforms and twelve at four, and every one of
// them a place for the copy to drift from what the other page actually says.
// Here each card is rendered from the registry entry the target page is itself
// built from, so a platform can only ever be described one way.
//
// Deliberately a server component with no interactivity: it renders on the
// force-static gamma-levels pages, and a client component there would ship JS
// to every anonymous visitor for what is a list of links.

export default function IntegrationsStrip({
  exclude,
  heading = 'Trade on a different platform?',
}: {
  /** The integration(s) whose own page this is — omitted from the list. */
  exclude: IntegrationId | readonly IntegrationId[];
  heading?: string;
}) {
  const others = otherIntegrations(exclude);
  if (others.length === 0) return null;

  return (
    <section
      style={{
        border: '1px solid var(--border-default)',
        borderRadius: 18,
        padding: '28px',
        marginBottom: 48,
        background: 'var(--color-surface)',
      }}
    >
      <h2 style={{ margin: '0 0 6px 0', fontSize: 24, fontWeight: 800, letterSpacing: '-0.3px' }}>
        {heading}
      </h2>
      <p
        style={{
          margin: '0 0 22px 0',
          fontSize: 14,
          lineHeight: 1.65,
          color: 'var(--color-text-secondary)',
          maxWidth: 720,
        }}
      >
        The same levels, drawn by whichever platform you actually trade from. Whether one updates itself comes
        down to what its scripting language is allowed to do — not to the plan you are on.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 14,
          marginBottom: 22,
        }}
      >
        {others.map((entry) => {
          const isAuto = entry.updates === 'auto';
          const Icon = isAuto ? RefreshCw : PencilLine;
          return (
            <Link
              key={entry.id}
              href={entry.href}
              style={{
                display: 'block',
                border: '1px solid var(--border-default)',
                borderRadius: 14,
                padding: '18px',
                textDecoration: 'none',
                color: 'inherit',
                background: 'var(--color-bg)',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: `var(${entry.accent})`,
                  marginBottom: 10,
                }}
              >
                <Icon size={11} />
                {entry.tier === 'pro' ? 'Pro' : 'Free'} · {isAuto ? 'Auto-updating' : 'Manual entry'}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{entry.platform}</div>
              <p
                style={{
                  margin: 0,
                  fontSize: 12.5,
                  lineHeight: 1.6,
                  color: 'var(--color-text-secondary)',
                }}
              >
                {entry.updatesNote}
              </p>
            </Link>
          );
        })}
      </div>

      <Link
        href={INTEGRATIONS_HUB.href}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '11px 20px',
          borderRadius: 999,
          fontSize: 14,
          fontWeight: 800,
          textDecoration: 'none',
          border: '1px solid var(--border-default)',
          color: 'var(--color-text-primary)',
        }}
      >
        Compare all {INTEGRATIONS.length} integrations <ArrowRight size={16} />
      </Link>
    </section>
  );
}
