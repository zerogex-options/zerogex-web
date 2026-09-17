// https://zerogex.io/embed/image/<SYMBOL>.png — today's levels as an image.
//
// The companion to the /embed/<SYMBOL> iframe, for the surfaces that refuse
// one: Substack and Medium strip custom embeds, Discord is a chat client, and
// no mail client runs a frame. An <img> is what all of them accept.
//
// The URL ends in .png on purpose. Several of those platforms decide whether a
// pasted link is an image by looking at the extension before they look at a
// Content-Type header, so `/embed/image/SPX` would be a link and
// `/embed/image/SPX.png` is a picture. The suffix is optional here — both
// resolve — but the builder only ever hands out the .png form.
//
// Card design, and why the timestamp is set so large, is in ./levelsCard.tsx.

import { serverApiGet } from '@/core/api/serverFetch';
import { SYMBOLS, type PickerSymbol } from '@/core/symbols';
import type { GexSummary } from '@/core/gexSummary';
import { CARD_CONTENT_TYPE, renderLevelsCard, type CardTheme } from './levelsCard';

// Satori needs the Node runtime, and searchParams make this per-request. The
// upstream read is still the shared 900s-cached one.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REVALIDATE_SECONDS = 900;

export async function GET(
  request: Request,
  context: { params: Promise<{ symbol: string }> },
): Promise<Response> {
  const { symbol: raw } = await context.params;
  // Tolerate the extension the builder hands out, and only that one.
  const upper = (raw || '').replace(/\.png$/i, '').toUpperCase();

  if (!(SYMBOLS as readonly string[]).includes(upper)) {
    return new Response('Unknown symbol', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  const symbol = upper as PickerSymbol;

  const theme: CardTheme =
    new URL(request.url).searchParams.get('theme') === 'light' ? 'light' : 'dark';

  const data = await serverApiGet<GexSummary>(
    `/api/gex/summary?symbol=${symbol}&underlying=${symbol}`,
    REVALIDATE_SECONDS,
  );

  return renderLevelsCard(symbol, data, theme, {
    'Content-Type': CARD_CONTENT_TYPE,
    // Deliberately short, and deliberately not the whole story. Our own cache
    // honors this; Substack's re-host, Gmail's image proxy and Discord's CDN
    // do not, which is exactly why the card dates itself on its face.
    'Cache-Control': `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=3600`,
    // Hotlinked from other origins by construction.
    'Access-Control-Allow-Origin': '*',
    // One image per symbol per theme, repeated wherever it is pasted.
    'X-Robots-Tag': 'noindex, follow',
  });
}
