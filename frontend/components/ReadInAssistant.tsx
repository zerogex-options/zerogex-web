'use client';

import Link from 'next/link';
import { ArrowRight, Bot } from 'lucide-react';
import { capture } from '@/core/telemetry/posthog-client';

// "Read these levels inside Claude" — the assistant counterpart to the
// plot-on-your-chart blocks above it on the gamma-levels pages.
//
// Deliberately NOT an entry in core/integrations.ts. That registry describes
// chart platforms: each has a landing page, a downloadable script, a scripting
// language chip, and an `updates` value that falls out of whether that language
// may make HTTP calls. None of that applies here — there is nothing to
// download, and the strip it feeds is headed "Trade on a different platform?",
// which an MCP server is not. Same funnel step, different category.
//
// A client component, unlike IntegrationsStrip, for the two CTA clicks alone.
// The reason that strip stays a server component still holds — these pages are
// force-static and mostly read by anonymous visitors, so shipping JS to all of
// them needs to buy something — and here it does: this block is a new bet on a
// new surface, and `mcp_server_clicked` is how we find out whether it is being
// used or scrolled past. Nothing else here is interactive, and the PostHog
// bundle is already on these pages for the paid funnel, so the marginal cost is
// this file. Drop the 'use client' if the event is ever retired.
//
// Kept compact on purpose. The Sierra Chart note above explains the constraint
// — there is already a lot below the fold here, and the evergreen content that
// makes these pages rank has to stay reachable.

const MCP_URL = 'https://zerogex.io/mcp';

export default function ReadInAssistant({ symbol }: { symbol?: string }) {
  const code: React.CSSProperties = {
    fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
    fontSize: 13,
    background: 'var(--color-brand-primary)14',
    border: '1px solid var(--color-brand-primary)33',
    borderRadius: 8,
    padding: '3px 9px',
    color: 'var(--color-text-primary)',
    whiteSpace: 'nowrap',
  };

  // `symbol` is the page's primary ticker, so an SPX reader's take-up rate is
  // separable from an NQ reader's. Omitted rather than defaulted when the block
  // is rendered somewhere without one, so a missing value never reads as SPX.
  const track = (action: 'setup' | 'learn_more') =>
    capture('mcp_server_clicked', symbol ? { action, symbol } : { action });

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
          border: '1px solid var(--color-brand-primary)44',
          background: 'var(--color-brand-primary)14',
          borderRadius: 999,
          padding: '5px 14px',
          marginBottom: 16,
        }}
      >
        <Bot size={12} /> Free · Claude, ChatGPT &amp; Cursor
      </div>

      <h2 style={{ margin: '0 0 12px 0', fontSize: 24, fontWeight: 800, letterSpacing: '-0.3px' }}>
        Read these levels inside Claude
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
        Add <span style={code}>{MCP_URL}</span> to your AI assistant once, and you can ask
        &ldquo;where is the SPX gamma flip?&rdquo; in an ordinary conversation. It reads the same
        delayed levels this page shows — the flip, both walls, max pain and the pin strike — instead
        of guessing at a number. No key, no account, nothing to install.
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
        Works with any Model Context Protocol client. In Claude, add it as a custom connector; in
        Claude Code, <span style={{ ...code, fontSize: 12 }}>claude mcp add --transport http zerogex {MCP_URL}</span>.
        Every answer carries the snapshot&apos;s age, so a delayed level can&apos;t be quoted as a live one.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link
          href="/help/platform/mcp-server"
          onClick={() => track('setup')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '11px 20px',
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 800,
            textDecoration: 'none',
            background: 'var(--color-brand-primary)',
            color: '#ffffff',
          }}
        >
          Set it up <ArrowRight size={16} />
        </Link>
        <Link
          href="/education/gamma-levels-in-claude"
          onClick={() => track('learn_more')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '11px 20px',
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 700,
            textDecoration: 'none',
            border: '1px solid var(--border-default)',
            color: 'var(--color-text-primary)',
          }}
        >
          What you can ask it
        </Link>
      </div>
    </section>
  );
}
