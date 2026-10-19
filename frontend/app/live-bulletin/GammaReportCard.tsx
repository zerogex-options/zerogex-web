'use client';

import { forwardRef, useMemo } from 'react';
import { useChartTheme } from '@/hooks/useChartTheme';
import { PIN_STRIKE_COLOR_HEX } from '@/core/pinStrike';
import { readableLevelInk, toHex, type Rgb } from '@/core/levelInk';
import { useMeasuredSize } from '@/components/useMeasuredWidth';
import {
  fmtNetGex,
  fmtPrice,
  fmtSignedPct,
  fmtSignedPts,
  regimeCopy,
  type ExpectedRange,
  type ReportModel,
} from './bulletinHelpers';
import { fmtLevelDelta, ladderScale, spreadLabels } from './ladderLayout';

// Card colors are pulled from the active palette at render time via
// useChartTheme, so the exported PNG matches whatever theme the operator has
// selected (Wall Street navy, Miami neon, Kyoto pine, California coral).
// The PNG export draws the card as an image that sees none of the page's CSS,
// so plain color strings (rather than raw var(--...) references) keep it
// reliable.
type CardColors = {
  bgTop: string;
  bgBottom: string;
  border: string;
  panel: string;
  panelBorder: string;
  textPrimary: string;
  textSecondary: string;
  textFaint: string;
  amber: string;
  flip: string;
  maxpain: string;
  bull: string;
  bear: string;
  blue: string;
  pin: string;
  coral: string;
  pink: string;
  peach: string;
  ocean: string;
};

function buildCardColors(chart: ReturnType<typeof useChartTheme>): CardColors {
  // Always render the card on a dark, "quant terminal" surface so the exported
  // asset holds up on both light and dark reposts — but pull the accent hues
  // from the current palette so the brand palette shows through.
  const bgTop = mixHex(chart.info || '#04141E', '#000000', 0.85);
  const bgBottom = mixHex(chart.info || '#07212F', '#000000', 0.72);
  // A light-mode palette's hues are tuned for a cream page, and some are too
  // deep to read on this dark card (Wall Street's info blue is #0E3A53). Every
  // hue that paints text or a level goes through readableLevelInk, which
  // leaves a readable color untouched and otherwise lightens it, same hue,
  // until it clears 4.5:1 against the card.
  const onCard = readableOn(mixHex(bgTop, bgBottom, 0.5));
  return {
    bgTop,
    bgBottom,
    border: hexAlpha(chart.accentHot || chart.gold || '#F59E0B', 0.24),
    panel: 'rgba(255, 255, 255, 0.035)',
    panelBorder: 'rgba(255, 255, 255, 0.08)',
    textPrimary: '#F3F7FB',
    textSecondary: '#A7BACB',
    textFaint: '#6A8296',
    amber: onCard(chart.accentHot || chart.gold || '#F59E0B'),
    // The two levels that carry their own app-wide hue rather than a palette
    // accent: the flip is azure everywhere it's drawn, max pain gold. The card
    // used the palette's hot accent for the flip (the last-price hue) and the
    // info blue for max pain, so neither matched the charts it summarizes.
    flip: onCard(chart.flip || '#3B9EFF'),
    maxpain: onCard(chart.maxpain || '#F0B429'),
    bull: onCard(chart.bull || '#1BC47D'),
    bear: onCard(chart.bear || '#FF5A66'),
    blue: onCard(chart.info || '#3B82F6'),
    pin: onCard(PIN_STRIKE_COLOR_HEX),
    coral: chart.series[1] || chart.bear || '#FF6361',
    pink: chart.maroon || '#E0527E',
    peach: chart.gold || '#FFD380',
    ocean: chart.navy || chart.info || '#2563EB',
  };
}

// Blend `hex` toward `target` by `t` in [0,1]. Used to darken the palette's
// info hue into the two-stop card background gradient.
function mixHex(hex: string, target: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(hex) ?? [0, 0, 0];
  const [br, bg, bb] = hexToRgb(target) ?? [0, 0, 0];
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  const toHex2 = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex2(lerp(ar, br))}${toHex2(lerp(ag, bg))}${toHex2(lerp(ab, bb))}`;
}

// Convert a #RRGGBB (or #RGB) into rgba() at the given alpha.
function hexAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex) ?? [255, 255, 255];
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hexToRgb(hex: string): Rgb | null {
  const s = hex.trim().replace('#', '');
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return null;
  const n = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

// A color shaded just enough to read on `bg`; anything unparseable is returned
// as given, never worse than painting it directly.
function readableOn(bg: string): (color: string) => string {
  const bgRgb = hexToRgb(bg);
  return (color) => {
    const rgb = hexToRgb(color);
    return rgb && bgRgb ? toHex(readableLevelInk(rgb, bgRgb)) : color;
  };
}

export interface GammaReportCardProps {
  model: ReportModel;
  headline: string;
  lead: string;
  asOf: string;
  /** Rasterized PNG data URL of the brand wordmark; falls back to text until ready. */
  logoUrl?: string | null;
  /** Tiled brand watermark across the card body. Defaults on; off for the admin variant. */
  watermark?: boolean;
  width?: number;
}

// The card's design width. Two columns: the read on the left, the positioning
// map standing beside it as a price ladder. Wide enough that the exported PNG
// sits close to square, which a feed shows whole instead of cropping.
export const REPORT_CARD_WIDTH = 800;
const MAP_COLUMN_WIDTH = 350;

const GammaReportCard = forwardRef<HTMLDivElement, GammaReportCardProps>(function GammaReportCard(
  { model, headline, lead, asOf, logoUrl, watermark = true, width = REPORT_CARD_WIDTH },
  ref,
) {
  const chart = useChartTheme();
  const C = useMemo(() => buildCardColors(chart), [chart]);

  // The brand ribbon spans the palette's spectrum: gold → warm accent →
  // primary accent → maroon → deep info blue. Every hue is a live theme
  // token, so the ribbon shifts with the palette.
  const BRAND_SWATH = `linear-gradient(90deg, ${C.peach} 0%, ${C.amber} 26%, ${C.coral} 52%, ${C.pink} 74%, ${C.ocean} 100%)`;

  const REGIME_ACCENT: Record<ReportModel['regime'], string> = {
    positive: C.bull,
    negative: C.bear,
    neutral: C.amber,
    unresolved: C.textFaint,
  };

  // The palette's body font (set on <html>), so the card typography matches
  // the site theme. The PNG export resolves the variables on its copy of the
  // card and embeds the face (imageExport.ts): an undefined var() voids the
  // whole declaration, so the fallbacks after it would not have applied.
  const FONT_STACK = 'var(--font-body), var(--font-display), -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Helvetica, Arial, sans-serif';

  const accent = REGIME_ACCENT[model.regime];
  const copy = regimeCopy(model.regime);

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
      {/* the regime's hue, glowing up from behind the read */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          left: -140,
          width: 460,
          height: 460,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${hexAlpha(accent, 0.13)} 0%, transparent 70%)`,
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
      {watermark && <Watermark textPrimary={C.textPrimary} />}

      <div style={{ position: 'relative', padding: '28px 28px 22px' }}>
        {/* Brand row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* 44px, not the 52 the old wordmark used: the lockup is 3.3:1
                where the wordmark was 2.6:1, so this keeps the brand row the
                same width and leaves room for the symbol badge and timestamp
                opposite it. */}
            <BrandMark logoUrl={logoUrl} height={44} coral={C.coral} />
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: 1.7,
                color: C.textFaint,
                textTransform: 'uppercase',
              }}
            >
              Dealer Gamma Positioning
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, color: C.textSecondary }}>
            <span
              style={{
                fontWeight: 800,
                letterSpacing: 1,
                color: C.textPrimary,
                background: 'rgba(255,255,255,0.07)',
                border: `1px solid ${C.panelBorder}`,
                borderRadius: 8,
                padding: '5px 11px',
                fontSize: 13,
              }}
            >
              {model.symbol}
            </span>
            <span>{asOf}</span>
          </div>
        </div>

        <div style={{ height: 1, background: C.panelBorder, margin: '20px 0 22px' }} />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `minmax(0, 1fr) ${MAP_COLUMN_WIDTH}px`,
            columnGap: 26,
          }}
        >
          {/* The read: regime, headline, summary, then the numbers the map
              can't carry (spot's move, net GEX, the expected range). */}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '6px 13px',
                  borderRadius: 999,
                  background: hexAlpha(accent, 0.14),
                  border: `1px solid ${hexAlpha(accent, 0.45)}`,
                  boxShadow: `0 0 22px ${hexAlpha(accent, 0.18)}`,
                  color: accent,
                  fontSize: 11.5,
                  fontWeight: 800,
                  letterSpacing: 1.2,
                }}
              >
                {model.regimeBadge}
              </span>
              <span style={{ fontSize: 12, color: C.textSecondary, fontWeight: 600, letterSpacing: 0.2 }}>
                {copy.label}
              </span>
            </div>

            <h1
              style={{
                fontSize: 30,
                lineHeight: 1.14,
                fontWeight: 800,
                margin: '18px 0 12px',
                letterSpacing: -0.6,
              }}
            >
              {headline}
            </h1>
            <p
              style={{
                fontSize: 13.5,
                lineHeight: 1.62,
                color: C.textSecondary,
                margin: 0,
              }}
            >
              {lead}
            </p>

            <Stats model={model} C={C} />
          </div>

          <MapPanel model={model} C={C} accent={accent} />
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 22,
            paddingTop: 16,
            borderTop: `1px solid ${C.panelBorder}`,
            fontSize: 11,
            color: C.textFaint,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <BrandMark logoUrl={logoUrl} height={16} coral={C.coral} />
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
function Watermark({ textPrimary }: { textPrimary: string }) {
  const rows = Array.from({ length: 16 });
  const cols = Array.from({ length: 8 });
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
                color: textPrimary,
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

// Renders the brand lockup from a pre-rasterized PNG data URL (so it embeds
// cleanly in the PNG export); falls back to a styled "ZEROGEX" text lockup
// while the logo is still rasterizing or if it fails to load.
function BrandMark({ logoUrl, height, coral }: { logoUrl?: string | null; height: number; coral: string }) {
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
          background: coral,
          boxShadow: `0 0 10px ${coral}`,
          display: 'inline-block',
        }}
      />
      <span style={{ fontSize: height * 0.62, fontWeight: 800, letterSpacing: 2.2 }}>ZEROGEX</span>
    </span>
  );
}

function makeCardLabel(color: string): React.CSSProperties {
  return {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color,
    marginBottom: 5,
  };
}

// The numbers the map doesn't draw: spot's move on the day, net GEX (the size
// and sign of the dealer book behind the regime), and the expected range's
// exact bounds and odds. Pinned to the bottom of the column so it lines up
// with the foot of the map beside it.
function Stats({ model, C }: { model: ReportModel; C: CardColors }) {
  const changeColor =
    model.changePct == null ? C.textSecondary : model.changePct >= 0 ? C.bull : C.bear;
  const netGexColor = model.netGex == null ? C.textPrimary : model.netGex >= 0 ? C.bull : C.bear;
  return (
    <div style={{ marginTop: 'auto', paddingTop: 22 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          columnGap: 18,
          paddingTop: 18,
          borderTop: `1px solid ${C.panelBorder}`,
        }}
      >
        <div>
          <div style={makeCardLabel(C.textFaint)}>
            {model.symbol} Spot{model.spotIsProjected ? '*' : ''}
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.05, letterSpacing: -0.5 }}>
            {fmtPrice(model.spot)}
          </div>
          <div style={{ color: changeColor, fontSize: 13.5, fontWeight: 700, marginTop: 5 }}>
            {fmtSignedPts(model.changeAbs)} ({fmtSignedPct(model.changePct)})
          </div>
        </div>
        <div>
          <div style={makeCardLabel(C.textFaint)}>Net GEX</div>
          <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.05, letterSpacing: -0.5, color: netGexColor }}>
            {fmtNetGex(model.netGex)}
          </div>
          <div style={{ color: C.textSecondary, fontSize: 12, fontWeight: 600, marginTop: 6 }}>
            {model.netGex == null
              ? 'unresolved this snapshot'
              : model.netGex >= 0
                ? 'dealers net long gamma'
                : 'dealers net short gamma'}
          </div>
        </div>
      </div>
      {model.spotIsProjected && (
        // Cash index outside the session: spot is projected from the future,
        // not a live print. Flag it so the card (and the tweet PNG that
        // screenshots it) never reads as a live SPX quote.
        <div style={{ fontSize: 12, fontWeight: 700, color: C.amber, marginTop: 8 }}>
          * Spot is futures-implied via {model.spotSourceLabel ?? 'futures'} · cash closed
        </div>
      )}
      {model.expectedRange && <ExpectedRangeStat range={model.expectedRange} C={C} />}
    </div>
  );
}

// The probability-bounded prediction: the 1σ implied expected-move band for
// the chosen horizon (shaded on the map), and a sentence on how the dealer
// walls sit relative to it.
function ExpectedRangeStat({ range, C }: { range: ExpectedRange; C: CardColors }) {
  const pct = (range.sigmaPct * 100).toFixed(1);
  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.panelBorder}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ ...makeCardLabel(C.textFaint), display: 'flex', alignItems: 'center', gap: 7 }}>
          {/* the band's own swatch, so the eye can find it on the map */}
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: hexAlpha(C.blue, 0.3),
              border: `1px solid ${hexAlpha(C.blue, 0.8)}`,
            }}
          />
          Expected Range · {range.horizonLabel}
        </div>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: C.blue, whiteSpace: 'nowrap' }}>
          ~68% · 1σ · {range.volIndex} {range.vix.toFixed(1)}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 1, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: -0.3 }}>
          {fmtPrice(range.low)} – {fmtPrice(range.high)}
        </span>
        <span style={{ fontSize: 12, color: C.textSecondary, fontWeight: 600 }}>
          ±{fmtPrice(range.moveAbs)} (±{pct}%) {range.horizonPhrase}
        </span>
      </div>
      <p style={{ margin: '7px 0 0', fontSize: 11.5, lineHeight: 1.5, color: C.textSecondary }}>
        {range.context}
      </p>
    </div>
  );
}

function MapPanel({ model, C, accent }: { model: ReportModel; C: CardColors; accent: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: C.panel,
        border: `1px solid ${C.panelBorder}`,
        borderRadius: 16,
        padding: '14px 14px 12px',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ ...makeCardLabel(C.textSecondary), marginBottom: 0 }}>Positioning Map</div>
        {/* The bulletin has no Expiry selector: it always reads the whole
            chain. Say so, because the chart's 0DTE pick is shared across tabs
            and a reader coming from a 0DTE board will otherwise assume this
            card follows it. */}
        <div style={{ fontSize: 10, color: C.textFaint, letterSpacing: 0.3 }}>All expirations · not 0DTE</div>
      </div>
      <PositioningLadder model={model} C={C} accent={accent} />
    </div>
  );
}

// ── The positioning map: a vertical price ladder ────────────────────────────
//
// Every level on one price axis, highest at the top, so the setup reads the
// way a trader already pictures it: resistance overhead, support underneath,
// spot between them. The axis is to scale, so the gaps are real distances.
// Above the flip the ladder is tinted for positive gamma, below it for
// negative, which makes the regime visible as the side of the line spot is on.
// Each level is a rung on the rail with its label to the right (name, price,
// distance from spot); labels that would collide step aside along a leader
// line while the rung stays at the true price. Spot is the pill on the left,
// inside the shaded 1σ expected-range band.

type Rung = { key: string; label: string; value: number; color: string };

const RAIL_X = 118; // the rail's x within the ladder
const LABEL_X = RAIL_X + 30; // where the level labels start
const EDGE = 34; // ladder px kept clear above the top price and below the bottom one
const ROW_GAP = 22; // the closest two label rows may sit (center to center)
const SPOT_PILL_H = 28;
// Drawn before the ladder has measured itself (and on the server): the size
// it lays out at with an average-length read beside it.
const FALLBACK_SIZE = { w: MAP_COLUMN_WIDTH - 28, h: 420 };

function PositioningLadder({ model, C, accent }: { model: ReportModel; C: CardColors; accent: string }) {
  const [ladderRef, size] = useMeasuredSize<HTMLDivElement>();
  const W = Math.floor(size?.w ?? FALLBACK_SIZE.w);
  const H = Math.floor(size?.h ?? FALLBACK_SIZE.h);

  // Top-to-bottom in the usual order, so equal prices stack in this order too.
  const rungs: Rung[] = [
    { key: 'call', label: 'Call Wall', value: model.callWall, color: C.bear },
    { key: 'pin', label: 'Pin Strike', value: model.pinStrike, color: C.pin },
    { key: 'pain', label: 'Max Pain', value: model.maxPain, color: C.maxpain },
    { key: 'flip', label: 'Flip', value: model.gammaFlip, color: C.flip },
    { key: 'put', label: 'Put Wall', value: model.putWall, color: C.bull },
  ].filter((r): r is Rung => r.value != null && Number.isFinite(r.value));

  const spot = model.spot != null && Number.isFinite(model.spot) ? model.spot : null;
  const band = model.expectedRange;
  const flip = model.gammaFlip;

  const container: React.CSSProperties = {
    position: 'relative',
    flex: '1 1 auto',
    minHeight: 400,
    borderRadius: 12,
    overflow: 'hidden',
  };

  if (rungs.length + (spot != null ? 1 : 0) < 2) {
    return (
      <div ref={ladderRef} style={{ ...container, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 12, color: C.textFaint }}>Levels unavailable for this snapshot</span>
      </div>
    );
  }

  const prices = rungs.map((r) => r.value);
  if (spot != null) prices.push(spot);
  if (band) prices.push(band.low, band.high);
  const y = ladderScale(prices, EDGE, H - EDGE);

  // Labels never crowd past the top and bottom insets, which hold the zone tags.
  const labelY = spreadLabels(
    rungs.map((r) => y(r.value)),
    ROW_GAP,
    EDGE - 8,
    H - EDGE + 8,
  );

  const flipY = flip != null && Number.isFinite(flip) ? y(flip) : null;
  const spotY = spot != null ? y(spot) : null;
  const bandTop = band ? y(band.high) : 0;
  const bandBottom = band ? y(band.low) : 0;
  // The 1σ edge tags sit at the band's edges unless the band is so thin that
  // they would run into the spot pill; then they stand just clear of it.
  const pillClear = SPOT_PILL_H / 2 + 10;
  const bandHighTagY = band && spotY != null ? Math.min(bandTop, spotY - pillClear) : bandTop;
  const bandLowTagY = band && spotY != null ? Math.max(bandBottom, spotY + pillClear) : bandBottom;

  const railTop = EDGE - 16;
  const railBottom = H - EDGE + 16;
  const upper = flipY == null ? null : Math.min(Math.max(flipY, railTop), railBottom);

  return (
    <div ref={ladderRef} style={container}>
      {/* Regime zones: positive gamma above the flip, negative below. */}
      {flipY != null && (
        <>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: Math.max(0, flipY),
              background: `linear-gradient(90deg, ${hexAlpha(C.bull, 0.15)} 0%, ${hexAlpha(C.bull, 0.03)} 75%)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: Math.max(0, flipY),
              bottom: 0,
              background: `linear-gradient(90deg, ${hexAlpha(C.bear, 0.15)} 0%, ${hexAlpha(C.bear, 0.03)} 75%)`,
            }}
          />
          {flipY >= EDGE && <ZoneTag top={8} color={C.bull} glyph="+γ" text="Positive gamma" />}
          {H - flipY >= EDGE && <ZoneTag bottom={8} color={C.bear} glyph="−γ" text="Negative gamma" />}
        </>
      )}

      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}
        aria-hidden
      >
        {/* the flip: the line between the two regimes, drawn up to the rail.
            Left out when spot sits on the flip, where the pill would leave
            only a stub of it showing. */}
        {flipY != null && (spotY == null || Math.abs(flipY - spotY) > SPOT_PILL_H / 2 + 2) && (
          <line x1={0} x2={RAIL_X} y1={flipY} y2={flipY} stroke={hexAlpha(C.flip, 0.7)} strokeWidth={1.25} strokeDasharray="6 4" />
        )}
        {/* the shaded 1σ expected-range band, around the rail */}
        {band && (
          <rect
            x={RAIL_X - 12}
            y={bandTop}
            width={24}
            height={Math.max(0, bandBottom - bandTop)}
            rx={12}
            fill={hexAlpha(C.blue, 0.3)}
            stroke={hexAlpha(C.blue, 0.9)}
            strokeWidth={1.25}
          />
        )}
        {/* the rail, in each zone's color */}
        {upper == null ? (
          <line x1={RAIL_X} x2={RAIL_X} y1={railTop} y2={railBottom} stroke={hexAlpha(C.textFaint, 0.8)} strokeWidth={3} strokeLinecap="round" />
        ) : (
          <>
            <line x1={RAIL_X} x2={RAIL_X} y1={railTop} y2={upper} stroke={hexAlpha(C.bull, 0.85)} strokeWidth={3} strokeLinecap="round" />
            <line x1={RAIL_X} x2={RAIL_X} y1={upper} y2={railBottom} stroke={hexAlpha(C.bear, 0.85)} strokeWidth={3} strokeLinecap="round" />
          </>
        )}
        {/* rungs and leader lines */}
        {rungs.map((r, i) => {
          const ry = y(r.value);
          const ly = labelY[i];
          return (
            <g key={r.key}>
              <polyline
                points={`${RAIL_X + 9},${ry} ${RAIL_X + 15},${ry} ${LABEL_X - 8},${ly} ${LABEL_X - 3},${ly}`}
                fill="none"
                stroke={hexAlpha(r.color, 0.6)}
                strokeWidth={1.25}
              />
              <line x1={RAIL_X - 8} x2={RAIL_X + 9} y1={ry} y2={ry} stroke={r.color} strokeWidth={2.75} strokeLinecap="round" />
            </g>
          );
        })}
      </svg>

      {/* 1σ edge tags */}
      {band && (
        <>
          <BandTag y={bandHighTagY} sign="+" value={band.high} C={C} />
          <BandTag y={bandLowTagY} sign="−" value={band.low} C={C} />
        </>
      )}

      {/* level labels: name, price, distance from spot */}
      {rungs.map((r, i) => (
        <div
          key={r.key}
          style={{
            position: 'absolute',
            left: LABEL_X,
            right: 0,
            top: labelY[i] - 10,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
          }}
        >
          <span
            style={{
              width: 62,
              flexShrink: 0,
              fontSize: 8.5,
              fontWeight: 800,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              color: r.color,
            }}
          >
            {r.label}
          </span>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, letterSpacing: -0.2 }}>
            {fmtPrice(r.value)}
          </span>
          {spot != null && (
            <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: C.textSecondary }}>
              {fmtLevelDelta(r.value, spot)}
            </span>
          )}
        </div>
      ))}

      {/* spot: a pill pointing at its place on the rail */}
      {spotY != null && spot != null && (
        <>
          <div
            style={{
              position: 'absolute',
              left: RAIL_X - 6,
              top: spotY - 6,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: C.textPrimary,
              boxShadow: `0 0 0 3px ${hexAlpha(accent, 0.45)}, 0 0 16px ${hexAlpha(accent, 0.9)}`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: `calc(100% - ${RAIL_X - 14}px)`,
              top: spotY - SPOT_PILL_H / 2,
              height: SPOT_PILL_H,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 9px',
              borderRadius: 8,
              background: C.textPrimary,
              color: C.bgTop,
              boxShadow: '0 6px 18px rgba(0, 0, 0, 0.35)',
              whiteSpace: 'nowrap',
            }}
          >
            {/* starred when projected, pointing at the futures-implied note */}
            <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 1, opacity: 0.7 }}>
              {model.spotIsProjected ? 'SPOT*' : 'SPOT'}
            </span>
            <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.2 }}>{fmtPrice(spot)}</span>
            {/* the pointer */}
            <span
              style={{
                position: 'absolute',
                right: -4,
                top: SPOT_PILL_H / 2 - 4,
                width: 8,
                height: 8,
                background: C.textPrimary,
                transform: 'rotate(45deg)',
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

// The regime a zone of the ladder is in. The glyph stays outside the
// uppercase transform, which would turn γ into Γ.
function ZoneTag({
  top,
  bottom,
  color,
  glyph,
  text,
}: {
  top?: number;
  bottom?: number;
  color: string;
  glyph: string;
  text: string;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 9,
        top,
        bottom,
        display: 'flex',
        alignItems: 'baseline',
        gap: 5,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 800 }}>{glyph}</span>
      <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>{text}</span>
    </div>
  );
}

function BandTag({ y, sign, value, C }: { y: number; sign: '+' | '−'; value: number; C: CardColors }) {
  return (
    <div
      style={{
        position: 'absolute',
        right: `calc(100% - ${RAIL_X - 16}px)`,
        top: y - 8,
        height: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        whiteSpace: 'nowrap',
        color: C.blue,
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 800, opacity: 0.85 }}>{sign}1σ</span>
      <span style={{ fontSize: 11.5, fontWeight: 800 }}>{fmtPrice(value)}</span>
    </div>
  );
}

export default GammaReportCard;
