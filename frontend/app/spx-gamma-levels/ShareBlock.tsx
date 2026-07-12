'use client';

import { useState, useSyncExternalStore, type CSSProperties } from 'react';
import { Check, Copy, MessageSquare, Share2 } from 'lucide-react';
import { capture } from '@/core/telemetry/posthog-client';

// The daily "copy/paste share block" that turns the free gamma-levels page from
// a static SEO asset into a distribution asset. It renders the current-session
// SPX/SPY/QQQ snapshot (pre-formatted server-side) as a plain-text snippet plus
// one-click actions to push it to X, Reddit, StockTwits, or the clipboard
// (Discord/Slack/anywhere). This component is purely presentational +
// interactive — all formatting lives in the server component so the snippet is
// baked into the ISR HTML and stays in sync with the levels below it.

interface ShareBlockProps {
  /** Pre-formatted, copy-ready plain-text snapshot (built server-side). */
  snippet: string;
  /** Canonical public URL embedded in the snippet / used as the native share target. */
  shareUrl: string;
  /** Whether the snapshot carried any usable levels this session. */
  hasData: boolean;
  /** Human-readable freshness stamp, e.g. "Jul 6, 2026, 9:41 AM EDT". */
  asOf?: string | null;
  /** Page's primary ticker (SPX / SPY / QQQ) — leads the heading + subtext. */
  symbol: string;
}

const SHARE_TITLE = "Today's SPX / SPY / QQQ gamma levels — ZeroGEX";

function XIcon({ size = 15 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function RedditIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
    </svg>
  );
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API is unavailable in insecure contexts / older browsers —
    // fall back to a hidden textarea, then finally to a prompt so the user can
    // always grab the snippet.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      window.prompt('Copy the snapshot below', text);
      return false;
    }
  }
}

const cardStyle: CSSProperties = {
  padding: '26px',
  marginBottom: 28,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const primaryBtn: CSSProperties = {
  padding: '10px 18px',
  fontSize: 14,
};

const outlineBtn: CSSProperties = {
  padding: '10px 16px',
  fontSize: 14,
};

const outlineHover = 'transition-colors hover:!border-[var(--color-brand-primary)] hover:!text-[var(--color-brand-primary)]';

// navigator.share availability is a static client capability, so read it via
// useSyncExternalStore (server snapshot = false) rather than a mount effect —
// SSR-safe, no synchronous setState-in-effect.
const subscribeNoop = () => () => {};
const getCanNativeShareClient = () =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';
const getCanNativeShareServer = () => false;

export default function ShareBlock({ snippet, shareUrl, hasData, asOf, symbol }: ShareBlockProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const canNativeShare = useSyncExternalStore(
    subscribeNoop,
    getCanNativeShareClient,
    getCanNativeShareServer,
  );

  const flash = (key: string) => {
    setCopied(key);
    window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1800);
  };

  const handleCopy = async () => {
    await copyToClipboard(snippet);
    flash('copy');
    capture('gamma_levels_share_clicked', { channel: 'copy' });
  };

  // StockTwits has no reliable pre-fill intent, so the anchor opens the site
  // (which survives popup blockers) while we copy the snippet alongside — the
  // transient "Copied" label cues the paste.
  const handleStockTwits = () => {
    void copyToClipboard(snippet).then((ok) => {
      if (ok) flash('stocktwits');
    });
    capture('gamma_levels_share_clicked', { channel: 'stocktwits' });
  };

  const handleNativeShare = async () => {
    capture('gamma_levels_share_clicked', { channel: 'native' });
    try {
      await navigator.share({ title: SHARE_TITLE, text: snippet, url: shareUrl });
    } catch {
      // User dismissed the sheet, or the platform rejected it — nothing to do.
    }
  };

  // The snippet already ends with the share URL, so X/Reddit get the whole
  // block as the post body (no duplicate url= param).
  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(snippet)}`;
  const redditHref = `https://www.reddit.com/submit?title=${encodeURIComponent(
    SHARE_TITLE,
  )}&text=${encodeURIComponent(snippet)}`;

  return (
    <section aria-labelledby="share-levels-heading" className="zg-panel" style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Share2 size={18} style={{ color: 'var(--color-brand-primary)' }} />
        <h2
          id="share-levels-heading"
          style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.3px', color: 'var(--color-text-primary)' }}
        >
          Share today&rsquo;s {symbol} gamma levels
        </h2>
      </div>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-secondary)', maxWidth: 660 }}>
        Want to share this morning&rsquo;s {symbol} gamma map? Copy the snapshot below.
      </p>

      {hasData ? (
        <>
          <pre
            style={{
              margin: 0,
              fontFamily: 'var(--font-jetbrains-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
              fontSize: 13,
              lineHeight: 1.75,
              color: 'var(--color-text-primary)',
              background: 'var(--color-bg)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-panel)',
              padding: '16px 18px',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {snippet}
          </pre>

          {asOf && (
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', opacity: 0.7, marginTop: -6 }}>
              As of {asOf} · delayed ~15 minutes
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <button type="button" onClick={handleCopy} style={primaryBtn} className="zg-btn zg-btn--primary">
              {copied === 'copy' ? <Check size={16} /> : <Copy size={16} />}
              {copied === 'copy' ? 'Copied!' : 'Copy snapshot'}
            </button>
            <a
              href={xHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => capture('gamma_levels_share_clicked', { channel: 'x' })}
              style={outlineBtn}
              className={`zg-btn zg-btn--secondary ${outlineHover}`}
            >
              <XIcon /> Post to X
            </a>
            <a
              href={redditHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => capture('gamma_levels_share_clicked', { channel: 'reddit' })}
              style={outlineBtn}
              className={`zg-btn zg-btn--secondary ${outlineHover}`}
            >
              <RedditIcon /> Post to Reddit
            </a>
            <a
              href="https://stocktwits.com/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleStockTwits}
              style={outlineBtn}
              className={`zg-btn zg-btn--secondary ${outlineHover}`}
            >
              <MessageSquare size={16} /> {copied === 'stocktwits' ? 'Copied — paste in' : 'StockTwits'}
            </a>
            {canNativeShare && (
              <button type="button" onClick={handleNativeShare} style={outlineBtn} className={`zg-btn zg-btn--secondary ${outlineHover}`}>
                <Share2 size={16} /> Share&hellip;
              </button>
            )}
          </div>

          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)', opacity: 0.8 }}>
            Copy works anywhere &mdash; paste it straight into Discord, Slack, WhatsApp, or a group chat.
          </p>
        </>
      ) : (
        <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
          Today&rsquo;s levels are still loading &mdash; the shareable snapshot will appear here as soon as the
          snapshot refreshes. Check back in a minute.
        </div>
      )}
    </section>
  );
}
