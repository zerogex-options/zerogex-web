'use client';

import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { SYMBOLS, type PickerSymbol } from '@/core/symbols';
import { capture } from '@/core/telemetry/posthog-client';
import { TelemetryEvent } from '@/core/telemetry/events';

// The snippet builder on /embed. Picks a symbol and a theme, previews the real
// widget in a live iframe, and hands over the paste-ready HTML.
//
// The generated snippet is three things, and only the first is the product:
//   1. the <iframe>, which is the daily-refreshing value the embedder keeps;
//   2. a plain <a> in the HOST's markup, which is the actual link — a link
//      inside the frame would point from our own origin to our own origin;
//   3. the optional embed.js <script>, which sizes the frame to its content.
//
// The anchor text is deliberately descriptive rather than keyword-stuffed, and
// the page tells the embedder they may rewrite it. Google's stance on widget
// links is that identical optimized anchors distributed at scale are a link
// scheme; an honest, editable credit line is not. That is also the only version
// worth shipping under the white-hat rule the outreach kit already sets.

const SITE = 'https://zerogex.io';

type Theme = 'dark' | 'light';

/** Mirrors the widget's own fallback height, before embed.js sizes it. */
const FALLBACK_HEIGHT = 200;

const LABEL: Record<PickerSymbol, string> = {
  SPX: 'SPX · S&P 500 index',
  SPY: 'SPY · S&P 500 ETF',
  QQQ: 'QQQ · Nasdaq-100 ETF',
  NDX: 'NDX · Nasdaq-100 index',
  ES: 'ES · S&P 500 futures',
  NQ: 'NQ · Nasdaq-100 futures',
};

function buildSnippet(symbol: PickerSymbol, theme: Theme, host: string): string {
  const slug = `${symbol.toLowerCase()}-gamma-levels`;
  const ref = host ? `&ref=${encodeURIComponent(host)}` : '';
  return `<!-- ZeroGEX — free ${symbol} gamma levels, 15-minute delayed -->
<iframe src="${SITE}/embed/${symbol}?theme=${theme}${ref}"
        title="${symbol} gamma levels by ZeroGEX"
        width="100%" height="${FALLBACK_HEIGHT}" loading="lazy"
        style="border:0;max-width:680px" data-zerogex-embed></iframe>
<p style="font:400 12px/1.4 sans-serif;opacity:.7;max-width:680px">
  <a href="${SITE}/${slug}">${symbol} gamma levels</a> by ZeroGEX — free, 15-minute delayed.
</p>
<script async src="${SITE}/embed.js"></script>`;
}

/**
 * The PNG card's URL for a symbol and theme.
 *
 * Kept deliberately bare — no utm parameters. This string gets pasted as an
 * <img src> or dropped in a chat box, where a query string is visible clutter
 * and, on the platforms that re-host the file, discarded anyway. The card
 * carries its own attribution on its face instead.
 */
function buildImageUrl(symbol: PickerSymbol, theme: Theme): string {
  return `${SITE}/embed/image/${symbol}.png${theme === 'light' ? '?theme=light' : ''}`;
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Insecure context or an older browser — same textarea fallback the daily
    // share block uses, so the snippet is always obtainable.
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
      return false;
    }
  }
}

const fieldStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
  fontSize: 14,
} as const;

const legendStyle = {
  display: 'block',
  fontSize: 11,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
  marginBottom: 6,
} as const;

export default function EmbedBuilder() {
  const [symbol, setSymbol] = useState<PickerSymbol>('SPX');
  const [theme, setTheme] = useState<Theme>('dark');
  const [host, setHost] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);

  const trimmedHost = host.trim().slice(0, 64);
  const snippet = useMemo(
    () => buildSnippet(symbol, theme, trimmedHost),
    [symbol, theme, trimmedHost],
  );
  const previewSrc = `/embed/${symbol}?theme=${theme}`;
  const imageUrl = buildImageUrl(symbol, theme);

  const copyWithTelemetry = async (
    text: string,
    format: 'iframe' | 'image',
    done: (v: boolean) => void,
  ) => {
    const ok = await copy(text);
    capture(TelemetryEvent.EmbedSnippetCopied, {
      action: ok ? 'copy' : 'copy_failed',
      format,
      symbol,
      theme,
      host: trimmedHost || null,
    });
    if (ok) {
      done(true);
      setTimeout(() => done(false), 2000);
    }
  };

  const onCopy = () => copyWithTelemetry(snippet, 'iframe', setCopied);
  const onCopyImage = () => copyWithTelemetry(imageUrl, 'image', setCopiedImage);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
        <label>
          <span style={legendStyle}>Symbol</span>
          <select
            style={fieldStyle}
            value={symbol}
            onChange={(e) => setSymbol(e.target.value as PickerSymbol)}
          >
            {SYMBOLS.map((s) => (
              <option key={s} value={s}>
                {LABEL[s]}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span style={legendStyle}>Theme</span>
          <select style={fieldStyle} value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>

        <label>
          <span style={legendStyle}>Your site (optional)</span>
          <input
            style={fieldStyle}
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="yoursite.com"
            maxLength={64}
            aria-describedby="host-help"
          />
        </label>
      </div>
      <p id="host-help" style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: -8 }}>
        Only used to tag the link so we can see which sites send readers. Nothing is stored about
        your visitors, and the widget sets no cookies.
      </p>

      <div>
        <span style={legendStyle}>Live preview</span>
        <iframe
          key={previewSrc}
          src={previewSrc}
          title={`${symbol} gamma levels preview`}
          width="100%"
          height={FALLBACK_HEIGHT}
          style={{ border: 0, maxWidth: 680, colorScheme: 'normal' }}
        />
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <span style={legendStyle}>Paste this into your page</span>
          <button
            type="button"
            onClick={onCopy}
            className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 14 }}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'Copied' : 'Copy snippet'}
          </button>
        </div>
        <textarea
          readOnly
          value={snippet}
          rows={10}
          spellCheck={false}
          onFocus={(e) => e.currentTarget.select()}
          style={{
            ...fieldStyle,
            fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
            fontSize: 12.5,
            lineHeight: 1.6,
            resize: 'vertical',
          }}
        />
      </div>

      {/* The image alternative. Presented as a peer of the snippet rather than
          a footnote: for anyone publishing on Substack, in Discord or by
          email, it is not a fallback, it is the only thing that works. */}
      <div
        style={{
          borderTop: '1px solid var(--border-default)',
          paddingTop: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 6px 0' }}>
            Can&rsquo;t paste HTML? Use the image
          </h3>
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--color-text-secondary)', margin: 0 }}>
            Substack, Medium, Discord and email newsletters all refuse custom embeds. They accept
            an image, and this URL renders the same levels as a PNG.{' '}
            <strong style={{ color: 'var(--color-text-primary)' }}>
              It is a snapshot, not a live card
            </strong>{' '}
            &mdash; those platforms copy the file onto their own servers when you post it, so your
            readers see the levels as they were at that moment. That is why the card prints its own
            &ldquo;as of&rdquo; time: a snapshot that can tell you how old it is stays honest, and
            for a daily note that is usually exactly what you want.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <input
            readOnly
            value={imageUrl}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Image URL"
            style={{
              ...fieldStyle,
              flex: 1,
              minWidth: 260,
              fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
              fontSize: 12.5,
            }}
          />
          <button
            type="button"
            onClick={onCopyImage}
            className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', fontSize: 14 }}
          >
            {copiedImage ? <Check size={15} /> : <Copy size={15} />}
            {copiedImage ? 'Copied' : 'Copy URL'}
          </button>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element -- a plain <img>
            is the point: this is exactly the markup an embedder will paste, and
            next/image would rewrite the URL through the optimizer and show them
            something they cannot reproduce. */}
        <img
          src={imageUrl.replace(SITE, '')}
          alt={`${symbol} gamma levels card`}
          width={680}
          style={{ width: '100%', maxWidth: 680, height: 'auto', borderRadius: 10 }}
        />
      </div>
    </div>
  );
}
