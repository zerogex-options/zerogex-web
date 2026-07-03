import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { serverApiGet } from '@/core/api/serverFetch';
import { resolveSymbol } from '@/core/symbols';

// Server-side rendered Live Bulletin PNG.
//
// The interactive Live Bulletin card at ``/live-bulletin`` is rendered client-
// side (see LiveBulletinClient / GammaReportCard) and rasterized via the
// browser's <foreignObject> path when the operator hits "Download PNG". That
// story is great for humans but useless for headless callers — a scheduled
// cron on the OA host has no browser, and we don't want to add Playwright to
// the OA image just to bake a PNG.
//
// Instead, this route renders the same numbers via ``next/og``'s server-side
// ``ImageResponse`` — identical to how the Replay snapshot OG card at
// ``/replay/[symbol]/[date]/snapshot/[time]/opengraph-image.tsx`` works. The
// Python bulletin_tweet job just GETs this URL and gets image/png bytes back,
// no browser required.
//
// URL: ``/api/bulletin/card?symbol=SPX&mode=close&date=2026-07-03``.
//   * symbol — required. Any of the valid ticker aliases resolveSymbol accepts.
//   * mode — optional. premarket | midday | close. Threaded through to the
//            top-line label ("PRE-MARKET" / "MIDDAY" / "CLOSE").
//   * date — optional. YYYY-MM-DD, defaults to today ET. Cosmetic label only —
//            the GEX numbers always come from the latest snapshot.
//
// Uncached — this is a live card by design. The tweet job hits it three times
// per trading day per symbol and expects fresh numbers each time.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const contentType = 'image/png';

const SIZE = { width: 1200, height: 675 };

interface GexSummary {
  timestamp: string;
  symbol: string;
  spot_price: number | null;
  gamma_flip: number | null;
  call_wall: number | null;
  put_wall: number | null;
  max_pain: number | null;
  net_gex: number | null;
  net_gex_at_spot: number | null;
  put_call_ratio: number | null;
}

type Mode = 'premarket' | 'midday' | 'close';
const MODE_LABEL: Record<Mode, string> = {
  premarket: 'PRE-MARKET READ',
  midday: 'MIDDAY READ',
  close: 'POST-MARKET READ',
};

function coerceMode(raw: string | null): Mode {
  if (raw === 'premarket' || raw === 'midday' || raw === 'close') return raw;
  return 'midday';
}

function fmtPrice(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return `$${v.toFixed(2)}`;
}

function fmtNetGex(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  const sign = v >= 0 ? '+' : '−';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtDateHuman(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      month: 'short', day: 'numeric', year: 'numeric',
    }).format(new Date(`${iso}T12:00:00Z`));
  } catch {
    return iso;
  }
}

function regimeCopy(gammaFlip: number | null, spot: number | null): { label: string; color: string } {
  if (gammaFlip == null || spot == null || spot <= 0) {
    return { label: 'FLIP UNRESOLVED', color: '#7E96A0' };
  }
  const rel = (spot - gammaFlip) / spot;
  if (Math.abs(rel) <= 0.0025) return { label: 'AT THE FLIP', color: '#FFD380' };
  if (rel > 0) return { label: '+ GAMMA REGIME', color: '#10B981' };
  return { label: '− GAMMA REGIME', color: '#F45854' };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const symbol = resolveSymbol(url.searchParams.get('symbol') || 'SPX');
  const mode = coerceMode(url.searchParams.get('mode'));
  const dateParam = url.searchParams.get('date');
  const iso = dateParam || new Date().toISOString().slice(0, 10);

  const summary = await serverApiGet<GexSummary>(
    `/api/gex/summary?symbol=${symbol}`,
    0, // uncached — tweet job needs fresh numbers on each fire
  );

  const spot = summary?.spot_price ?? null;
  const gammaFlip = summary?.gamma_flip ?? null;
  const callWall = summary?.call_wall ?? null;
  const putWall = summary?.put_wall ?? null;
  const maxPain = summary?.max_pain ?? null;
  const netGex = summary?.net_gex ?? summary?.net_gex_at_spot ?? null;
  const regime = regimeCopy(gammaFlip, spot);
  const human = fmtDateHuman(iso);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #00202E 0%, #04141E 100%)',
          color: '#FFF1E6',
          fontFamily: 'sans-serif',
          padding: '52px 64px',
          position: 'relative',
        }}
      >
        {/* Brand stripe — same orange gradient as the replay OG card so the
            two social artifacts read as one family */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, height: 10,
            background: 'linear-gradient(90deg, #FF8531 0%, #FFD380 100%)',
            display: 'flex',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div
            style={{
              padding: '6px 16px',
              borderRadius: 999,
              border: `1px solid ${regime.color}66`,
              background: `${regime.color}15`,
              color: regime.color,
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              display: 'flex',
            }}
          >
            {MODE_LABEL[mode]}
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: '#C8D8DF',
              letterSpacing: '0.06em',
              display: 'flex',
            }}
          >
            {symbol} · {human}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 24 }}>
          <div
            style={{
              fontSize: 16, fontWeight: 800, letterSpacing: '0.18em',
              color: '#7E96A0', textTransform: 'uppercase', display: 'flex',
            }}
          >
            Spot
          </div>
          <div
            style={{
              marginTop: 6, fontSize: 92, fontWeight: 900, letterSpacing: '-2.5px',
              color: '#FFF1E6', lineHeight: 1, display: 'flex',
            }}
          >
            {fmtPrice(spot)}
          </div>
        </div>

        {/* Level grid — 4 tiles mirroring GammaReportCard's structure so the
            downloaded card and this rendered PNG stay visually aligned */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
          {[
            { label: 'Gamma Flip', value: fmtPrice(gammaFlip), color: '#FF8531' },
            { label: 'Call Wall', value: fmtPrice(callWall), color: '#F45854' },
            { label: 'Put Wall', value: fmtPrice(putWall), color: '#10B981' },
            { label: 'Max Pain', value: fmtPrice(maxPain), color: '#FFD380' },
          ].map((cell) => (
            <div
              key={cell.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                background: '#0B3344',
                borderRadius: 12,
                borderLeft: `4px solid ${cell.color}`,
                padding: '16px 20px',
              }}
            >
              <div
                style={{
                  fontSize: 13, fontWeight: 800, letterSpacing: '0.18em',
                  color: cell.color, textTransform: 'uppercase', display: 'flex',
                }}
              >
                {cell.label}
              </div>
              <div
                style={{
                  fontSize: 34, fontWeight: 900, color: '#FFF1E6',
                  marginTop: 6, letterSpacing: '-0.5px', display: 'flex',
                }}
              >
                {cell.value}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 12,
            padding: '14px 22px',
            borderRadius: 10,
            background: '#0B3344',
            border: '1px solid #1F4E5F',
            alignItems: 'baseline',
          }}
        >
          <div
            style={{
              fontSize: 14, fontWeight: 800, letterSpacing: '0.18em',
              color: '#7E96A0', textTransform: 'uppercase', display: 'flex',
            }}
          >
            Net GEX
          </div>
          <div
            style={{
              fontSize: 32, fontWeight: 900, color: '#FFF1E6',
              letterSpacing: '-0.5px', display: 'flex',
            }}
          >
            {fmtNetGex(netGex)}
          </div>
        </div>

        {/* Site tagline — matches the LiveBulletinClient watermark so the
            branded PNG the tweet drops looks identical to the card in-app */}
        <div
          style={{
            position: 'absolute',
            bottom: 36, left: 64, right: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontSize: 30, fontWeight: 900, letterSpacing: '-0.5px',
              color: '#FFF1E6', display: 'flex',
            }}
          >
            ZeroGEX
          </div>
          <div
            style={{
              fontSize: 16, fontWeight: 700, letterSpacing: '0.06em',
              color: '#C8D8DF', display: 'flex',
            }}
          >
            zerogex.io / live-bulletin
          </div>
        </div>
      </div>
    ),
    { ...SIZE },
  );
}
