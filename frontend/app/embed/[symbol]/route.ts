// The embeddable ZeroGEX gamma-levels widget — https://zerogex.io/embed/<SYMBOL>
//
// A chrome-free, self-contained HTML card of today's delayed dealer-positioning
// levels, built to be iframed into someone else's page: a trading blog, a
// Substack, a Discord-adjacent site, a broker's education corner. It refreshes
// itself every market day, so an embed placed once keeps paying out.
//
// WHY A ROUTE HANDLER AND NOT A PAGE. app/layout.tsx reads cookies() and
// declares eighteen font families behind the palette picker. Both are right for
// the site and wrong for a frame rendering inside a stranger's page: the cookie
// read opts every route into per-request rendering, and the fonts would put
// hundreds of KB of someone else's brand on the host's critical path. A route
// handler owes the root layout nothing, so this ships one ~4KB document with
// inline CSS, system fonts, and no React runtime.
//
// It serves exactly the derived-levels zone the public /<ticker>-gamma-levels
// pages already render — wall and flip LEVELS, max pain, net GEX magnitudes,
// delayed reference spot — through the same 900s-cached `serverApiGet`, so it
// shares those pages' cache entries and is licensing-clean by the same
// construction as /mcp. No raw chain, no per-contract quotes, no price stream.
//
// The SEO mechanism lives in the SNIPPET, not in here. A link inside an iframe
// is a link from this URL, which is our own origin — worth nothing to us. The
// backlink is the plain <a> that app/embed/page.tsx puts in the HOST page's
// markup next to the frame. This document is the reason the embedder keeps it.

import { serverApiGet } from '@/core/api/serverFetch';
import { SYMBOLS, optionChainSymbolFor, type PickerSymbol } from '@/core/symbols';
import { longGammaAtSpot, netGexAtSpotOrNull } from '@/core/gammaRegime';
import { fmtNetGex, fmtPrice, fmtTimestampET, type GexSummary } from '@/core/gexSummary';

// Reads searchParams, so it can never be statically rendered. Upstream data is
// still cached: `serverApiGet` sets the 900s fetch revalidate, and the response
// carries its own s-maxage below, which is what bounds backend load no matter
// how many host pages frame this.
export const dynamic = 'force-dynamic';

const SITE = 'https://zerogex.io';

/** Same 15-minute cache the free levels pages and /mcp share. */
const REVALIDATE_SECONDS = 900;

type Theme = 'dark' | 'light';

interface Palette {
  bg: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  bull: string;
  bear: string;
}

// Drawn from the brand's own social-card palette (app/spx-gamma-levels/
// gammaOgImage.tsx) rather than the CSS custom properties: this document is
// standalone, so it cannot inherit globals.css, and a host page's stylesheet
// must never be able to repaint it.
const PALETTES: Record<Theme, Palette> = {
  dark: {
    bg: 'linear-gradient(135deg,#00202E 0%,#042D3F 100%)',
    card: 'rgba(255,241,230,0.04)',
    border: 'rgba(255,133,49,0.22)',
    text: '#FFF1E6',
    muted: 'rgba(255,241,230,0.62)',
    accent: '#FF8531',
    bull: '#1BC47D',
    bear: '#FF4D5A',
  },
  light: {
    bg: '#FFFFFF',
    card: '#F7F5F2',
    border: 'rgba(0,32,46,0.14)',
    text: '#00202E',
    muted: 'rgba(0,32,46,0.62)',
    accent: '#C4491E',
    bull: '#0F9960',
    bear: '#D93B47',
  },
};

/**
 * Escape every interpolated value.
 *
 * Most of what lands in the template is a number this module formatted itself,
 * but `theme` and the symbol arrive from the URL and the "as of" stamp arrives
 * from the API. Escaping at the single point of interpolation is cheaper to
 * keep true than reasoning about which of the three can carry a `<`.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveTheme(raw: string | null): Theme {
  return raw === 'light' ? 'light' : 'dark';
}

/** The public levels page a given symbol's widget links back to. */
function levelsHref(symbol: PickerSymbol, ref: string): string {
  const params = new URLSearchParams({
    utm_source: 'embed',
    utm_medium: 'widget',
    utm_campaign: `${symbol.toLowerCase()}-gamma-levels`,
  });
  // The embedding host, when the snippet declared one. Turns "widgets sent
  // traffic" into "which sites' widgets sent traffic", which is the number
  // that decides where the next outreach hour goes.
  if (ref) params.set('utm_content', ref);
  return `${SITE}/${symbol.toLowerCase()}-gamma-levels?${params.toString()}`;
}

interface Cell {
  label: string;
  value: string;
  tone?: 'bull' | 'bear';
}

function cells(data: GexSummary): Cell[] {
  const netGex = netGexAtSpotOrNull(data.net_gex_at_spot);
  return [
    { label: 'Gamma flip', value: fmtPrice(data.gamma_flip) },
    { label: 'Call wall', value: fmtPrice(data.call_wall) },
    { label: 'Put wall', value: fmtPrice(data.put_wall) },
    {
      label: 'Net GEX @ spot',
      value: fmtNetGex(netGex),
      tone: netGex == null ? undefined : netGex >= 0 ? 'bull' : 'bear',
    },
  ];
}

/** The regime pill's copy and tone, from the shared site-wide resolver. */
function regimeBadge(data: GexSummary): { label: string; tone: 'bull' | 'bear' | null } {
  const long = longGammaAtSpot(
    netGexAtSpotOrNull(data.net_gex_at_spot),
    data.spot_price ?? null,
    data.gamma_flip ?? null,
  );
  if (long === null) return { label: 'Regime unresolved', tone: null };
  return long
    ? { label: 'Dealers long gamma', tone: 'bull' }
    : { label: 'Dealers short gamma', tone: 'bear' };
}

function renderWidget(
  symbol: PickerSymbol,
  data: GexSummary | null,
  theme: Theme,
  ref: string,
): string {
  const p = PALETTES[theme];
  const href = levelsHref(symbol, ref);
  const chain = optionChainSymbolFor(symbol);
  const projected = chain !== symbol;

  // A null snapshot is a backend hiccup, not an empty market. Say so plainly
  // and keep the frame's shape: a host page whose widget silently collapses to
  // nothing is a host page that removes the widget.
  const regime = data ? regimeBadge(data) : null;

  const body = data && regime
    ? `
      <div class="head">
        <div class="sym">${esc(symbol)}</div>
        <div class="spot">
          <span class="spot-v">${esc(fmtPrice(data.spot_price))}</span>
          <span class="spot-l">ref. spot (delayed)</span>
        </div>
        <div class="pill${regime.tone ? ` ${regime.tone}` : ''}">${esc(regime.label)}</div>
      </div>
      <div class="grid">
        ${cells(data)
          .map(
            (c) => `<div class="cell">
          <div class="cl">${esc(c.label)}</div>
          <div class="cv${c.tone ? ` ${c.tone}` : ''}">${esc(c.value)}</div>
        </div>`,
          )
          .join('')}
      </div>
      <div class="foot">
        <span>As of ${esc(fmtTimestampET(data.timestamp))} · 15-min delayed${
          projected ? ` · from the ${esc(chain)} chain` : ''
        }</span>
        <a href="${esc(href)}" target="_blank" rel="noopener">ZeroGEX ↗</a>
      </div>`
    : `
      <div class="head">
        <div class="sym">${esc(symbol)}</div>
        <div class="pill">Data briefly unavailable</div>
      </div>
      <div class="empty">Today's ${esc(symbol)} levels are not loading right now. They refresh every 15 minutes.</div>
      <div class="foot">
        <span>Free delayed dealer positioning</span>
        <a href="${esc(href)}" target="_blank" rel="noopener">ZeroGEX ↗</a>
      </div>`;

  return `<!DOCTYPE html>
<html lang="en" data-theme="${esc(theme)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,follow">
<title>${esc(symbol)} gamma levels — ZeroGEX</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:transparent}
body{
  font:400 14px/1.45 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  color:${p.text};
  -webkit-font-smoothing:antialiased;
}
.w{background:${p.bg};border:1px solid ${p.border};border-radius:14px;padding:16px 18px;overflow:hidden}
.head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.sym{font-size:19px;font-weight:800;letter-spacing:-0.3px}
.spot{display:flex;align-items:baseline;gap:6px;margin-right:auto}
.spot-v{font-size:19px;font-weight:700;font-variant-numeric:tabular-nums}
.spot-l{font-size:11px;color:${p.muted}}
.pill{
  font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;
  padding:4px 10px;border-radius:999px;border:1px solid ${p.border};color:${p.muted};white-space:nowrap;
}
.pill.bull{color:${p.bull};border-color:${p.bull}55}
.pill.bear{color:${p.bear};border-color:${p.bear}55}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.cell{background:${p.card};border:1px solid ${p.border};border-radius:10px;padding:10px 11px;min-width:0}
.cl{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:${p.muted};margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cv{font-size:17px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cv.bull{color:${p.bull}}
.cv.bear{color:${p.bear}}
.empty{background:${p.card};border:1px solid ${p.border};border-radius:10px;padding:14px;font-size:13px;color:${p.muted}}
.foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;font-size:11px;color:${p.muted};flex-wrap:wrap}
.foot a{color:${p.accent};text-decoration:none;font-weight:700;white-space:nowrap}
.foot a:hover{text-decoration:underline}
@media(max-width:460px){.grid{grid-template-columns:repeat(2,1fr)}.spot{margin-right:0}}
</style>
</head>
<body>
<div class="w">${body}</div>
<script>
// Report our rendered height to the host so public/embed.js can size the
// iframe to the content. Hosts that do not load that script simply ignore
// these messages and keep the snippet's fixed fallback height.
//
// The re-announce schedule is the load-bearing part. The snippet loads
// embed.js with the async attribute, so the host's listener is very often
// registered AFTER this frame renders — and a height posted before
// anyone is listening is simply lost. Sending on a short bounded schedule
// costs a handful of no-op messages and removes the race; without it the
// widget renders at the fallback height on a majority of real pages, which
// looks like a broken embed and is nobody's job to report.
(function(){
  var card=document.querySelector('.w');
  var last=0;
  function send(force){
    var h=Math.ceil(card.getBoundingClientRect().height)+2;
    if(h===last&&!force)return;
    last=h;
    try{parent.postMessage({zerogexEmbed:1,height:h},'*');}catch(e){}
  }
  [0,50,150,400,1000,2500].forEach(function(ms){setTimeout(function(){send(1);},ms);});
  addEventListener('load',function(){send(1);});
  if(window.ResizeObserver)new ResizeObserver(function(){send(0);}).observe(card);
})();
</script>
</body>
</html>`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ symbol: string }> },
): Promise<Response> {
  const { symbol: raw } = await context.params;
  const upper = (raw || '').toUpperCase();

  // Unknown ticker: 404 rather than silently falling back to the default
  // symbol. A host page that typo'd the snippet should see it fail, not quietly
  // publish SPY levels under an "NVDA" heading.
  if (!(SYMBOLS as readonly string[]).includes(upper)) {
    return new Response('Unknown symbol', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  const symbol = upper as PickerSymbol;

  const url = new URL(request.url);
  const theme = resolveTheme(url.searchParams.get('theme'));
  // Free-form host label from the snippet; kept short and escaped everywhere
  // it is used, and only ever echoed into a utm_content value.
  const ref = (url.searchParams.get('ref') || '').slice(0, 64);

  const data = await serverApiGet<GexSummary>(
    `/api/gex/summary?symbol=${symbol}&underlying=${symbol}`,
    REVALIDATE_SECONDS,
  );

  return new Response(renderWidget(symbol, data, theme, ref), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Shared caches may hold this for the same 15 minutes the data is stale
      // by, and keep serving the old card for an hour while revalidating.
      'Cache-Control': `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=3600`,
      // This route exists to be framed. Everything else on the site is
      // SAMEORIGIN-only via next.config.ts; this is the deliberate exception.
      'Content-Security-Policy': "frame-ancestors *",
      // Thin by design and duplicated across every host that embeds it — it
      // must never compete with the levels page it advertises.
      'X-Robots-Tag': 'noindex, follow',
    },
  });
}
