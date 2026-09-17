import type { PickerSymbol } from '@/core/symbols';

// The two artifacts the widget is distributed as, built in one place.
//
// Both are now offered from two surfaces — the /embed builder and the block on
// each free levels page — and they are the kind of thing that silently drifts:
// a snippet whose attribution link is dropped on one surface still looks
// correct, still renders, and quietly stops being the reason the widget exists.
// Same argument as core/gexSummary.ts's formatters, for the same reason.
//
// Pure module, no 'use client', so a server component can build a snippet into
// static HTML and a client component can rebuild it on a symbol change.

export const SITE = 'https://zerogex.io';

export type EmbedTheme = 'dark' | 'light';

/** The iframe's fallback height, before embed.js sizes it to its content. */
export const FALLBACK_HEIGHT = 200;

/**
 * The paste-ready HTML.
 *
 * Three parts, and only the first is the product:
 *   1. the <iframe>, which is the daily-refreshing value the embedder keeps;
 *   2. a plain <a> in the HOST's markup, which is the actual link — one inside
 *      the frame would point from our origin to our origin;
 *   3. the embed.js <script>, which sizes the frame to its content.
 *
 * The anchor text is deliberately descriptive rather than keyword-stuffed, and
 * both surfaces tell the embedder they may rewrite it. Distributing one
 * identical optimized anchor at scale is what Google calls a link scheme; an
 * honest, editable credit line is not.
 */
export function buildEmbedSnippet(
  symbol: PickerSymbol,
  theme: EmbedTheme,
  host = '',
): string {
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
 * The PNG card's URL, for Substack, Medium, Discord and email — everywhere an
 * iframe is refused.
 *
 * Deliberately bare of utm parameters: this string is pasted as an <img src>
 * or dropped into a chat box, where a query string is visible clutter and, on
 * the platforms that re-host the file, discarded anyway. The card carries its
 * attribution on its face instead.
 *
 * The `.png` is load-bearing — several of those platforms decide whether a
 * pasted URL is an image from the extension before they read Content-Type.
 */
export function buildEmbedImageUrl(symbol: PickerSymbol, theme: EmbedTheme): string {
  return `${SITE}/embed/image/${symbol}.png${theme === 'light' ? '?theme=light' : ''}`;
}
