import { ImageResponse } from 'next/og';
import { optionChainSymbolFor, type PickerSymbol } from '@/core/symbols';
import { longGammaAtSpot, netGexAtSpotOrNull } from '@/core/gammaRegime';
import { fmtNetGex, fmtPrice, fmtTimestampET, type GexSummary } from '@/core/gexSummary';

// The PNG rendering of today's levels — the card for every surface that
// cannot run an iframe.
//
// WHY THIS EXISTS. The widget at /embed/<SYMBOL> is an iframe, and the places
// with the most market writing in them forbid those outright: Substack and
// Medium strip custom embeds, Discord is a chat client, and no mail client
// executes a frame. That is not a small tail — it is most of the people who
// publish a daily SPX note. An <img> is the only thing all four accept.
//
// WHAT IT IS NOT, AND WHY THE TIMESTAMP IS BIG. This does not update itself,
// and it is important not to imply otherwise. Substack re-hosts a pasted image
// onto its own CDN, Gmail proxies and caches one, Discord serves its own copy:
// in all three the reader sees the bytes as they were when the platform first
// fetched them, not as they are now. So this is a SNAPSHOT — correct at the
// moment of fetch and frozen afterwards — and the "as of" stamp is rendered at
// a size you cannot miss rather than as fine print. A cached card that cannot
// say how old it is would eventually misrepresent a level as current, which is
// the one failure that matters here.
//
// Same derived-levels zone and the same 900s-cached snapshot as the HTML
// widget, /mcp and the free pages — the caller fetches it and hands it in.

export const CARD_SIZE = { width: 1200, height: 630 };
export const CARD_CONTENT_TYPE = 'image/png';

export type CardTheme = 'dark' | 'light';

interface Palette {
  bg: string;
  tile: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  bull: string;
  bear: string;
}

// The social-card palette, so a levels PNG and a shared link preview look like
// the same product.
const PALETTES: Record<CardTheme, Palette> = {
  dark: {
    bg: 'linear-gradient(135deg, #00202E 0%, #042D3F 100%)',
    tile: 'rgba(255,241,230,0.05)',
    border: 'rgba(255,133,49,0.24)',
    text: '#FFF1E6',
    muted: '#C8D8DF',
    accent: '#FF8531',
    bull: '#2ED99B',
    bear: '#FF6B6B',
  },
  light: {
    bg: 'linear-gradient(135deg, #FFFFFF 0%, #F4F1EC 100%)',
    tile: '#FFFFFF',
    border: 'rgba(0,32,46,0.14)',
    text: '#00202E',
    muted: '#4A6472',
    accent: '#C4491E',
    bull: '#0F9960',
    bear: '#D93B47',
  },
};

export function cardAlt(symbol: string): string {
  return `${symbol} gamma levels today - gamma flip, call wall, put wall and net dealer GEX, from ZeroGEX`;
}

function regime(data: GexSummary): { label: string; color: string | null } {
  const long = longGammaAtSpot(
    netGexAtSpotOrNull(data.net_gex_at_spot),
    data.spot_price ?? null,
    data.gamma_flip ?? null,
  );
  if (long === null) return { label: 'Regime unresolved', color: null };
  return long
    ? { label: 'Dealers long gamma', color: 'bull' }
    : { label: 'Dealers short gamma', color: 'bear' };
}

export function renderLevelsCard(
  symbol: PickerSymbol,
  data: GexSummary | null,
  theme: CardTheme,
  /** Response headers, passed through to ImageResponse — a constructed one
      cannot reliably be re-headered after the fact. */
  headers: Record<string, string> = {},
): ImageResponse {
  const p = PALETTES[theme];
  const chain = optionChainSymbolFor(symbol);
  const netGex = data ? netGexAtSpotOrNull(data.net_gex_at_spot) : null;
  const badge = data ? regime(data) : null;

  const tiles: { label: string; value: string; color?: string }[] = data
    ? [
        { label: 'Gamma flip', value: fmtPrice(data.gamma_flip) },
        { label: 'Call wall', value: fmtPrice(data.call_wall) },
        { label: 'Put wall', value: fmtPrice(data.put_wall) },
        {
          label: 'Net GEX @ spot',
          value: fmtNetGex(netGex),
          color: netGex == null ? undefined : netGex >= 0 ? p.bull : p.bear,
        },
      ]
    : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: p.bg,
          color: p.text,
          fontFamily: 'sans-serif',
          // Bottom padding reserves the absolutely-positioned stamp's band,
          // so the content column below can center in what is actually left.
          padding: '54px 64px 168px',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 10,
            background: 'linear-gradient(90deg, #FF8531 0%, #FFD380 100%)',
            display: 'flex',
          }}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {/* Symbol, spot, regime */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <div style={{ fontSize: 76, fontWeight: 900, letterSpacing: '-2px', display: 'flex' }}>
            {symbol}
          </div>
          {data ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
              <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: '-1.5px', display: 'flex' }}>
                {fmtPrice(data.spot_price)}
              </div>
              <div style={{ fontSize: 22, color: p.muted, paddingBottom: 12, display: 'flex' }}>
                ref. spot
              </div>
            </div>
          ) : null}
          {badge ? (
            <div
              style={{
                marginLeft: 'auto',
                padding: '10px 22px',
                borderRadius: 999,
                border: `2px solid ${badge.color === 'bull' ? p.bull : badge.color === 'bear' ? p.bear : p.border}`,
                color: badge.color === 'bull' ? p.bull : badge.color === 'bear' ? p.bear : p.muted,
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                display: 'flex',
              }}
            >
              {badge.label}
            </div>
          ) : null}
        </div>

        {/* The levels */}
        {data ? (
          <div style={{ display: 'flex', gap: 18, marginTop: 30 }}>
            {tiles.map((tile) => (
              <div
                key={tile.label}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  background: p.tile,
                  border: `2px solid ${p.border}`,
                  borderRadius: 20,
                  padding: '26px 24px',
                }}
              >
                <div
                  style={{
                    fontSize: 21,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    color: p.muted,
                    marginBottom: 14,
                    display: 'flex',
                  }}
                >
                  {tile.label}
                </div>
                <div
                  style={{
                    // A tile is ~206px of content once padding is taken out,
                    // and fmtNetGex tops out at eight characters ("-$850.0M").
                    // At 52px that overflows, and Satori's answer is to break
                    // the value across two lines — which pushes the sign onto
                    // its own row and makes a negative print read as a stray
                    // dash. Step down past seven, and never allow the wrap.
                    fontSize: tile.value.length > 7 ? 42 : 52,
                    fontWeight: 800,
                    letterSpacing: '-1.2px',
                    whiteSpace: 'nowrap',
                    color: tile.color || p.text,
                    display: 'flex',
                  }}
                >
                  {tile.value}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              marginTop: 40,
              padding: '40px',
              background: p.tile,
              border: `2px solid ${p.border}`,
              borderRadius: 20,
              fontSize: 30,
              color: p.muted,
              display: 'flex',
            }}
          >
            Today&apos;s {symbol} levels are not available right now.
          </div>
        )}
        </div>

        {/* The stamp. Sized to be legible in a scaled-down post image, because
            a re-hosted copy of this file has no other way to date itself. */}
        <div
          style={{
            position: 'absolute',
            bottom: 52,
            left: 64,
            right: 64,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 27, fontWeight: 700, color: p.text, display: 'flex' }}>
              {data ? `As of ${fmtTimestampET(data.timestamp)}` : 'Levels refresh every 15 minutes'}
            </div>
            <div style={{ fontSize: 21, color: p.muted, marginTop: 7, display: 'flex' }}>
              {data
                ? `15-minute delayed${chain !== symbol ? ` · derived from the ${chain} option chain` : ''} · snapshot, not live`
                : 'Modeled dealer positioning · not investment advice'}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.5px', display: 'flex' }}>
              ZeroGEX
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: p.accent, marginTop: 6, display: 'flex' }}>
              zerogex.io/{symbol.toLowerCase()}-gamma-levels
            </div>
          </div>
        </div>
      </div>
    ),
    { ...CARD_SIZE, headers },
  );
}
