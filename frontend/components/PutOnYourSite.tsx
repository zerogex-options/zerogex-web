'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Code2, Copy } from 'lucide-react';
import { capture } from '@/core/telemetry/posthog-client';
import { TelemetryEvent } from '@/core/telemetry/events';
import type { PickerSymbol } from '@/core/symbols';
import { buildEmbedImageUrl, buildEmbedSnippet } from '@/core/embedSnippet';

// "Put these levels on your site" — the publisher's counterpart to the
// plot-on-your-chart and read-in-your-assistant blocks above it.
//
// Those hand a TRADER a way to use today's numbers where they already work.
// This hands the same thing to someone who WRITES about the session, which is
// a different person with a different job and, for us, a different payoff: a
// trader who takes the thinkorswim paste is a possible subscriber, while a
// writer who takes the snippet is a link and a daily billboard on an audience
// we do not own. The 4 September Search Console review named external links as
// the one thing on-page work cannot fix, and these pages are where the people
// who can supply them already land — /embed was reachable only from the
// footer, which is roughly how /scorecard ended up unreachable.
//
// Pre-filled with the page's own symbol on purpose, which is the entire reason
// this is not just a link to the builder. Same argument as the thinkorswim
// block: what the reader copies is what they are looking at, so grabbing it is
// one click rather than a page load, a picker and a scroll.
//
// Compact by deliberate constraint — see the Sierra Chart note in
// gammaLevels.tsx. There is already a lot below the fold here, and the
// evergreen content that makes these pages rank has to stay reachable. Options
// (themes, other tickers, the host field) live on /embed rather than here.

export default function PutOnYourSite({ symbol }: { symbol: PickerSymbol }) {
  const [copied, setCopied] = useState<'iframe' | 'image' | null>(null);

  // Dark is the only theme offered here. The builder has the picker; this
  // block's job is one click, and a second control would earn less than the
  // vertical space it costs on a page already carrying five of these sections.
  const snippet = buildEmbedSnippet(symbol, 'dark');
  const imageUrl = buildEmbedImageUrl(symbol, 'dark');

  const grab = async (format: 'iframe' | 'image') => {
    const text = format === 'iframe' ? snippet : imageUrl;
    let ok = true;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      ok = false;
    }
    capture(TelemetryEvent.EmbedSnippetCopied, {
      action: ok ? 'copy' : 'copy_failed',
      format,
      surface: 'levels_page',
      symbol,
      theme: 'dark',
    });
    if (ok) {
      setCopied(format);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const button = (format: 'iframe' | 'image', label: string, primary: boolean) => (
    <button
      type="button"
      onClick={() => grab(format)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '11px 20px',
        borderRadius: 999,
        fontSize: 14,
        fontWeight: primary ? 800 : 700,
        cursor: 'pointer',
        ...(primary
          ? { background: 'var(--color-brand-primary)', color: '#ffffff', border: 'none' }
          : {
              border: '1px solid var(--border-default)',
              color: 'var(--color-text-primary)',
              background: 'transparent',
            }),
      }}
    >
      {copied === format ? <Check size={16} /> : <Copy size={16} />}
      {copied === format ? 'Copied' : label}
    </button>
  );

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
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--color-brand-primary)',
          border: '1px solid color-mix(in srgb, var(--color-brand-primary) 27%, transparent)',
          background: 'color-mix(in srgb, var(--color-brand-primary) 8%, transparent)',
          borderRadius: 999,
          padding: '5px 14px',
          marginBottom: 16,
        }}
      >
        <Code2 size={12} /> Free · No signup · No API key
      </div>

      <h2 style={{ margin: '0 0 12px 0', fontSize: 24, fontWeight: 800, letterSpacing: '-0.3px' }}>
        Put these {symbol} levels on your site
      </h2>

      <p
        style={{
          margin: '0 0 16px 0',
          fontSize: 15,
          lineHeight: 1.65,
          color: 'var(--color-text-secondary)',
          maxWidth: 720,
        }}
      >
        If you write about the session, today&rsquo;s {symbol} levels are one line of HTML. Paste it once and it
        re-reads the chain every 15 minutes, so the {symbol} flip and walls under your writing stay
        current without you typing them in again. No account, no key, and it sets no cookies on
        your readers.
      </p>

      <p
        style={{
          margin: '0 0 20px 0',
          fontSize: 13,
          lineHeight: 1.6,
          color: 'var(--color-text-secondary)',
          opacity: 0.85,
          maxWidth: 720,
        }}
      >
        Publishing somewhere that blocks embeds&nbsp;- Substack, Medium, Discord, an email newsletter?
        Take the image instead. It is the same card as a PNG, and because those platforms copy it
        onto their own servers it is a snapshot of this moment rather than a live card, which is
        why it prints its own &ldquo;as of&rdquo; time.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {button('iframe', 'Copy embed code', true)}
        {button('image', 'Copy image URL', false)}
        <Link
          href="/embed"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 14,
            fontWeight: 700,
            textDecoration: 'none',
            color: 'var(--color-brand-primary)',
          }}
        >
          Preview and pick a theme <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  );
}
