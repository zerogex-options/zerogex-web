import Link from 'next/link';
import { ArrowRight, Bot } from 'lucide-react';

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
// A server component with no interactivity, for the reason IntegrationsStrip
// gives: these pages are force-static and read by anonymous visitors, so a
// copy-to-clipboard button would ship JS to all of them to save one selection.
//
// Kept compact on purpose. The Sierra Chart note above explains the constraint
// — there is already a lot below the fold here, and the evergreen content that
// makes these pages rank has to stay reachable.

const MCP_URL = 'https://zerogex.io/mcp';

export default function ReadInAssistant() {
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
