'use client';

import { forwardRef } from 'react';
import {
  fmtNetGex,
  fmtPrice,
  fmtRatio,
  fmtSignedPct,
  fmtSignedPts,
  regimeCopy,
  type ReportModel,
} from './bulletinHelpers';

// The card is a fully self-contained dark asset: every color is an explicit
// hex/rgba (never a CSS theme variable) so the exported PNG looks identical
// regardless of the operator's light/dark site theme, and so html-to-image
// never has to resolve a `var(--...)` against the live document.
const C = {
  bgTop: '#04141E',
  bgBottom: '#07212F',
  border: 'rgba(245, 158, 11, 0.22)',
  panel: 'rgba(255, 255, 255, 0.035)',
  panelBorder: 'rgba(255, 255, 255, 0.07)',
  textPrimary: '#F3F7FB',
  textSecondary: '#9DB1C4',
  textFaint: '#5E7689',
  amber: '#F59E0B',
  bull: '#1BC47D',
  bear: '#FF5A66',
  blue: '#3B82F6',
  // brand accents (pacificDesertSunset) used for the top swath + glow
  coral: '#FF6361',
  pink: '#E0527E',
  peach: '#FFD380',
  ocean: '#2563EB',
} as const;

// Sleek brand gradient used for the top ribbon + header wash.
const BRAND_SWATH = `linear-gradient(90deg, ${C.peach} 0%, ${C.amber} 26%, ${C.coral} 52%, ${C.pink} 74%, ${C.ocean} 100%)`;

const REGIME_ACCENT: Record<ReportModel['regime'], string> = {
  positive: C.bull,
  negative: C.bear,
  neutral: C.amber,
  unresolved: C.textFaint,
};

const FONT_STACK =
  '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export interface GammaReportCardProps {
  model: ReportModel;
  headline: string;
  lead: string;
  asOf: string;
  /** Rasterized PNG data URL of the brand wordmark; falls back to text until ready. */
  logoUrl?: string | null;
  width?: number;
}

const GammaReportCard = forwardRef<HTMLDivElement, GammaReportCardProps>(function GammaReportCard(
  { model, headline, lead, asOf, logoUrl, width = 640 },
  ref,
) {
  const accent = REGIME_ACCENT[model.regime];
  const copy = regimeCopy(model.regime);
  const changeColor =
    model.changePct == null ? C.textSecondary : model.changePct >= 0 ? C.bull : C.bear;

  return (
    <div
      ref={ref}
      style={{
        width,
        fontFamily: FONT_STACK,
        color: C.textPrimary,
        background: `linear-gradient(160deg, ${C.bgTop} 0%, ${C.bgBottom} 100%)`,
        border: `1px solid ${C.border}`,
        borderRadius: 22,
        overflow: 'hidden',
        position: 'relative',
        boxSizing: 'border-box',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {/* faint grid + glow overlays for the "quant terminal" texture */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      {/* soft brand wash sweeping across the header for depth */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 200,
          pointerEvents: 'none',
          opacity: 0.16,
          background: `radial-gradient(120% 100% at 100% 0%, ${C.coral} 0%, ${C.amber} 26%, transparent 60%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: -120,
          right: -80,
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accent}22 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* top gradient swath — the brand-accent ribbon flush to the card edge */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          background: BRAND_SWATH,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 6,
          left: 0,
          right: 0,
          height: 24,
          background: BRAND_SWATH,
          filter: 'blur(18px)',
          opacity: 0.55,
          pointerEvents: 'none',
        }}
      />

      {/* subtle tiled brand watermark — baked into the export so reposts stay
          attributed. Sits behind the content layer at low opacity. */}
      <Watermark />

      <div style={{ position: 'relative', padding: '30px 30px 22px' }}>
        {/* Brand row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <BrandMark logoUrl={logoUrl} height={52} />
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 1.6,
                color: C.textFaint,
                textTransform: 'uppercase',
              }}
            >
              Dealer Gamma Positioning
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              color: C.textSecondary,
            }}
          >
            <span
              style={{
                fontWeight: 800,
                letterSpacing: 1,
                color: C.textPrimary,
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${C.panelBorder}`,
                borderRadius: 7,
                padding: '4px 9px',
                fontSize: 12,
              }}
            >
              {model.symbol}
            </span>
            <span>{asOf}</span>
          </div>
        </div>

        <div style={{ height: 1, background: C.panelBorder, margin: '20px 0 18px' }} />

        {/* Regime badge + headline */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 12px',
            borderRadius: 999,
            background: `${accent}1f`,
            border: `1px solid ${accent}55`,
            color: accent,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 1.2,
            marginBottom: 14,
          }}
        >
          {model.regimeBadge}
          <span style={{ color: C.textSecondary, fontWeight: 600, letterSpacing: 0.3 }}>
            {copy.label}
          </span>
        </div>

        <h1
          style={{
            fontSize: 27,
            lineHeight: 1.18,
            fontWeight: 800,
            margin: '0 0 12px',
            letterSpacing: -0.4,
          }}
        >
          {headline}
        </h1>
        <p
          style={{
            fontSize: 13.5,
            lineHeight: 1.6,
            color: C.textSecondary,
            margin: 0,
          }}
        >
          {lead}
        </p>

        {/* Spot price strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 14,
            marginTop: 20,
            paddingTop: 18,
            borderTop: `1px solid ${C.panelBorder}`,
          }}
        >
          <div>
            <div style={CARD_LABEL}>{model.symbol} Spot</div>
            <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.05, letterSpacing: -0.5 }}>
              {fmtPrice(model.spot)}
            </div>
          </div>
          <div style={{ color: changeColor, fontSize: 17, fontWeight: 700, paddingBottom: 4 }}>
            {fmtSignedPts(model.changeAbs)}{' '}
            <span style={{ fontSize: 14 }}>({fmtSignedPct(model.changePct)})</span>
          </div>
        </div>

        {/* Metric grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            marginTop: 18,
          }}
        >
          <Metric label="Gamma Flip" value={fmtPrice(model.gammaFlip)} accent={C.amber} />
          <Metric
            label="Net GEX"
            value={fmtNetGex(model.netGex)}
            accent={model.netGex == null ? C.textPrimary : model.netGex >= 0 ? C.bull : C.bear}
          />
          <Metric label="Put / Call" value={fmtRatio(model.putCallRatio)} accent={C.textPrimary} />
          <Metric label="Call Wall" value={fmtPrice(model.callWall)} accent={C.bear} />
          <Metric label="Put Wall" value={fmtPrice(model.putWall)} accent={C.bull} />
          <Metric label="Max Pain" value={fmtPrice(model.maxPain)} accent={C.blue} />
        </div>

        {/* Gamma map */}
        <GammaMap model={model} />

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 20,
            paddingTop: 16,
            borderTop: `1px solid ${C.panelBorder}`,
            fontSize: 11,
            color: C.textFaint,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <BrandMark logoUrl={logoUrl} height={16} />
            <span style={{ color: C.textFaint, fontWeight: 500 }}>zerogex.io · @zerogex</span>
          </span>
          <span>Derived analytics · not financial advice</span>
        </div>
      </div>
    </div>
  );
});

// Faint diagonal "zerogex.io" tile across the whole card. Pure DOM text so it
// rasterizes reliably into the PNG export; rotated and oversized (inset -30%)
// so it fills the card edge-to-edge after rotation and can't be cleanly
// cropped out of a repost.
function Watermark() {
  const rows = Array.from({ length: 16 });
  const cols = Array.from({ length: 7 });
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: '-30%',
        pointerEvents: 'none',
        transform: 'rotate(-28deg)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 40,
        opacity: 0.05,
      }}
    >
      {rows.map((_, r) => (
        <div
          key={r}
          style={{ display: 'flex', gap: 54, justifyContent: 'center', whiteSpace: 'nowrap' }}
        >
          {cols.map((__, c) => (
            <span
              key={c}
              style={{
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: 1.5,
                color: C.textPrimary,
              }}
            >
              zerogex.io
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

// Renders the brand wordmark from a pre-rasterized PNG data URL (so it embeds
// cleanly in the PNG export); falls back to a styled "ZEROGEX" text lockup
// while the logo is still rasterizing or if it fails to load.
function BrandMark({ logoUrl, height }: { logoUrl?: string | null; height: number }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="ZeroGEX" style={{ height, width: 'auto', display: 'block' }} />;
  }
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span
        style={{
          width: height * 0.34,
          height: height * 0.34,
          borderRadius: '50%',
          background: C.coral,
          boxShadow: `0 0 10px ${C.coral}`,
          display: 'inline-block',
        }}
      />
      <span style={{ fontSize: height * 0.62, fontWeight: 800, letterSpacing: 2.2 }}>ZEROGEX</span>
    </span>
  );
}

const CARD_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 1.3,
  textTransform: 'uppercase',
  color: C.textFaint,
  marginBottom: 5,
};

function Metric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.panelBorder}`,
        borderRadius: 12,
        padding: '12px 13px',
      }}
    >
      <div style={CARD_LABEL}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: accent, letterSpacing: -0.2 }}>
        {value}
      </div>
    </div>
  );
}

// Horizontal positioning map: lays the put wall, flip, spot and call wall on a
// shared price axis so the viewer can see at a glance where price sits relative
// to the dealer magnets. Markers below the track = structural walls; above the
// track = flip + live spot.
type MapPoint = {
  key: string;
  label: string;
  value: number;
  color: string;
  side: 'above' | 'below';
  priority: number;
};

// Minimum horizontal separation (in % of track width) two labels need before
// they're considered overlapping. Sized to the widest label/value lockup
// ("Call Wall" / a 6-char price) against the ~580px inner card width.
const LABEL_MIN_GAP_PCT = 12;
const ROW_H = 24; // vertical space one stacked label row occupies
const TRACK_GAP = 13; // gap between the nearest label row and the track
const TRACK_H = 4;

// Greedily assign each point to the lowest vertical level (0 = nearest the
// track) that has no already-placed neighbour within LABEL_MIN_GAP_PCT. Points
// are processed in priority order so the most important marker on a side
// (e.g. live Spot) keeps the row closest to the track and lower-priority,
// colliding markers (e.g. Flip, when price is sitting on the flip) stack above
// or below it instead of printing on top of it.
function assignLevels(points: MapPoint[], pos: (v: number) => number) {
  const ordered = [...points].sort((a, b) => b.priority - a.priority);
  const levels: number[][] = [];
  const byKey = new Map<string, number>();
  for (const p of ordered) {
    const x = pos(p.value);
    let level = 0;
    for (;;) {
      const occupied = levels[level] ?? (levels[level] = []);
      if (occupied.every((other) => Math.abs(other - x) >= LABEL_MIN_GAP_PCT)) {
        occupied.push(x);
        byKey.set(p.key, level);
        break;
      }
      level += 1;
    }
  }
  const maxLevel = points.reduce((m, p) => Math.max(m, byKey.get(p.key) ?? 0), 0);
  return {
    levelOf: (key: string) => byKey.get(key) ?? 0,
    levelCount: points.length ? maxLevel + 1 : 0,
  };
}

function GammaMap({ model }: { model: ReportModel }) {
  const points: MapPoint[] = [
    { key: 'put', label: 'Put Wall', value: model.putWall!, color: C.bull, side: 'below' as const, priority: 1 },
    { key: 'flip', label: 'Flip', value: model.gammaFlip!, color: C.amber, side: 'above' as const, priority: 2 },
    { key: 'spot', label: 'Spot', value: model.spot!, color: C.textPrimary, side: 'above' as const, priority: 3 },
    { key: 'call', label: 'Call Wall', value: model.callWall!, color: C.bear, side: 'below' as const, priority: 1 },
  ].filter((p) => p.value != null && Number.isFinite(p.value));

  if (points.length < 2) return null;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = span * 0.08;
  const lo = min - pad;
  const hi = max + pad;
  const pos = (v: number) => ((v - lo) / (hi - lo)) * 100;

  const above = points.filter((p) => p.side === 'above');
  const below = points.filter((p) => p.side === 'below');
  const aboveLayout = assignLevels(above, pos);
  const belowLayout = assignLevels(below, pos);

  // Geometry derived from how many stacked rows each side actually needs, so a
  // collision-free map stays compact and a stacked one grows just enough.
  const trackY = aboveLayout.levelCount * ROW_H + TRACK_GAP;
  const height = trackY + TRACK_H + TRACK_GAP + belowLayout.levelCount * ROW_H;
  const tickTop = trackY - 5;
  const tickHeight = TRACK_H + 10;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={CARD_LABEL}>Positioning Map</div>
      <div style={{ position: 'relative', height, marginTop: 6 }}>
        {above.map((p) => (
          <Marker
            key={p.key}
            p={p}
            left={pos(p.value)}
            top={trackY - TRACK_GAP - (aboveLayout.levelOf(p.key) + 1) * ROW_H}
          />
        ))}
        {/* track */}
        <div
          style={{
            position: 'absolute',
            top: trackY,
            left: 0,
            right: 0,
            height: TRACK_H,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${C.bull}55, ${C.amber}55, ${C.bear}55)`,
          }}
        />
        {/* ticks */}
        {points.map((p) => (
          <div
            key={`tick-${p.key}`}
            style={{
              position: 'absolute',
              top: tickTop,
              left: `${pos(p.value)}%`,
              width: 2,
              height: tickHeight,
              marginLeft: -1,
              background: p.color,
              borderRadius: 1,
            }}
          />
        ))}
        {below.map((p) => (
          <Marker
            key={p.key}
            p={p}
            left={pos(p.value)}
            top={trackY + TRACK_H + TRACK_GAP + belowLayout.levelOf(p.key) * ROW_H}
          />
        ))}
      </div>
    </div>
  );
}

function Marker({
  p,
  left,
  top,
}: {
  p: { label: string; value: number; color: string };
  left: number;
  top: number;
}) {
  // Clamp the label box so edge markers don't overflow the card.
  const clamped = Math.min(92, Math.max(8, left));
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: `${clamped}%`,
        transform: 'translateX(-50%)',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        lineHeight: 1.15,
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: C.textFaint,
        }}
      >
        {p.label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: p.color }}>{fmtPrice(p.value)}</div>
    </div>
  );
}

export default GammaReportCard;
