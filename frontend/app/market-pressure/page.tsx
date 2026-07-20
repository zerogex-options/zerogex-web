'use client';

import PageShell from '@/components/layout/PageShell';
import { useMemo } from 'react';
import { ArrowLeftRight, Compass, Flame, Gauge, Layers, ShieldCheck, Wind } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useMarketPressureSignal } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import SignalEventsPanel from '@/components/SignalEventsPanel';
import SignalScoreHero from '@/components/SignalScoreHero';
import SignalPageTitle from '@/components/SignalPageTitle';
import SignalHowItsBuilt from '@/components/SignalHowItsBuilt';
import { PROPRIETARY_SIGNALS_REFRESH } from '@/core/refreshProfiles';
import {
  asObject,
  getNumber,
  humanize,
  parseScoreHistory,
  toTrend,
  trendColor,
  formatSigned,
  formatGexCompact,
  formatPct,
} from '@/core/signalHelpers';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './page.i18n';

const FADE_COLOR = 'var(--color-warning)';
const BULL_COLOR = 'var(--color-bull)';
const BEAR_COLOR = 'var(--color-bear)';

function labelFromLoading(loading: number | null): string {
  if (loading == null) return '—';
  if (loading >= 75) return 'Critical';
  if (loading >= 50) return 'Loaded';
  if (loading >= 25) return 'Building';
  return 'Discharged';
}

// Maps the API's (or fallback) band word to its translated display label,
// keeping the underlying English band value used for triggering logic.
function bandLabel(t: (key: string) => string, raw: string): string {
  switch (raw) {
    case 'Critical': return t('bandCritical');
    case 'Loaded': return t('bandLoaded');
    case 'Building': return t('bandBuilding');
    case 'Discharged': return t('bandDischarged');
    default: return raw;
  }
}

export default function MarketPressurePage() {
  const t = usePageT(dict);
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = useMarketPressureSignal(
    symbol,
    PROPRIETARY_SIGNALS_REFRESH.marketPressureMs,
  );

  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const score = getNumber(payload.score);
  const loadingVal = getNumber(payload.loading);
  const directionValue = getNumber(payload.direction_value);
  const confidenceMult = getNumber(payload.confidence_mult);
  const signalStr = String(payload.signal ?? 'discharged');
  const label = bandLabel(t, String(payload.label ?? labelFromLoading(loadingVal)));
  const playbook = typeof payload.playbook === 'string' ? payload.playbook : '';
  const triggered = payload.triggered === true || (loadingVal != null && loadingVal >= 50 && directionValue != null && Math.abs(directionValue) >= 0.2);
  const trend = toTrend(payload.direction);
  const directionalColor = trendColor(trend);

  const ctx = useMemo(() => {
    const raw = asObject(payload.context_values) ?? {};
    const compression = asObject(raw.compression) ?? {};
    const hedging = asObject(raw.hedging) ?? {};
    const flow = asObject(raw.flow) ?? {};
    const tension = asObject(raw.tension) ?? {};
    const dealer = asObject(raw.dealer) ?? {};
    const weights = asObject(raw.weights) ?? {};
    return {
      compression: {
        magnitude: getNumber(compression.magnitude) ?? getNumber(raw.compression),
        wallPinch: getNumber(compression.wall_pinch),
        flipProximity: getNumber(compression.flip_proximity),
        netGexMultiplier: getNumber(compression.net_gex_multiplier),
        callWall: getNumber(compression.call_wall),
        putWall: getNumber(compression.put_wall),
        flip: getNumber(compression.flip),
        spot: getNumber(compression.spot),
        netGex: getNumber(compression.net_gex),
      },
      hedging: {
        magnitude: getNumber(hedging.magnitude) ?? getNumber(raw.hedging),
        signed: getNumber(hedging.signed),
        vanna: getNumber(hedging.vanna),
        charm: getNumber(hedging.charm),
        charmAmp: getNumber(hedging.charm_amp),
        alpha: getNumber(hedging.alpha),
        alignmentBonus: getNumber(hedging.alignment_bonus),
        dealerDni: getNumber(hedging.dealer_dni),
      },
      flow: {
        magnitude: getNumber(flow.magnitude) ?? getNumber(raw.flow),
        signed: getNumber(flow.signed),
        premiumSkew: getNumber(flow.premium_skew),
        smartMoneySkew: getNumber(flow.smart_money_skew),
        totalFlux: getNumber(flow.total_flux),
      },
      tension: {
        magnitude: getNumber(tension.magnitude) ?? getNumber(raw.tension),
        ivRank: getNumber(tension.iv_rank),
        volSqueeze: getNumber(tension.vol_squeeze),
        shortSigma: getNumber(tension.short_sigma),
        longSigma: getNumber(tension.long_sigma),
      },
      dealer: {
        signed: getNumber(dealer.signed) ?? getNumber(raw.dealer),
        netDelta: getNumber(dealer.dealer_net_delta) ?? getNumber(dealer.net_delta),
      },
      weights: {
        hedging: getNumber(weights.hedging) ?? 0.45,
        flow: getNumber(weights.flow) ?? 0.40,
        dealer: getNumber(weights.dealer) ?? 0.15,
      },
    };
  }, [payload]);

  const history = useMemo(() => parseScoreHistory(payload.score_history), [payload]);

  // Card accent flips between "fade-safe" (warning) and "ride-the-break"
  // (directional) at the 50-loading threshold per the playbook design.
  const accentColor = loadingVal != null && loadingVal >= 50 ? directionalColor : FADE_COLOR;

  if (loading && !data) return <LoadingSpinner size="lg" />;

  const pillars: Array<{ key: string; label: string; magnitude: number | null; signed: number | null; color: string; description: string }> = [
    { key: 'compression', label: t('pillarCompressionLabel'), magnitude: ctx.compression.magnitude, signed: null, color: BULL_COLOR, description: t('pillarCompressionDesc') },
    { key: 'hedging', label: t('pillarHedgingLabel'), magnitude: ctx.hedging.magnitude, signed: ctx.hedging.signed, color: '#6EA8FE', description: t('pillarHedgingDesc') },
    { key: 'flow', label: t('pillarFlowLabel'), magnitude: ctx.flow.magnitude, signed: ctx.flow.signed, color: '#C084FC', description: t('pillarFlowDesc') },
    { key: 'tension', label: t('pillarTensionLabel'), magnitude: ctx.tension.magnitude, signed: null, color: FADE_COLOR, description: t('pillarTensionDesc') },
  ];

  const confidenceLabel = confidenceMult != null
    ? confidenceMult >= 1.15
      ? t('confidenceAllAligned')
      : confidenceMult >= 0.95
        ? t('confidencePartial')
        : t('confidenceForcesFighting')
    : '—';

  return (
    <PageShell>
      <SignalPageTitle
        title="Market Pressure Index"
        subtitle={t('subtitle')}
        icon={Gauge}
        tooltip={t('tooltip')}
      />

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <section className="zg-feature-shell p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
          <div className="lg:col-span-2">
            <SignalScoreHero
              score={score}
              trend={trend}
              interpretation={label}
              history={history}
              badges={
                <>
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide"
                    style={{ background: `${accentColor}1f`, color: accentColor }}
                  >
                    {triggered && <span className="h-1.5 w-1.5 rounded-full" style={{ background: accentColor }} />}
                    {humanize(signalStr)}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-[var(--color-border)]">
                    Loading
                    <span className="font-mono ml-1" style={{ color: accentColor }}>
                      {loadingVal != null ? loadingVal.toFixed(1) : '—'}
                    </span>
                  </span>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                    title={t('confidenceTooltip')}
                  >
                    {confidenceMult != null ? `${confidenceMult.toFixed(2)}× — ${confidenceLabel}` : '—'}
                  </span>
                </>
              }
              footnote={playbook ? <p className="leading-relaxed">{playbook}</p> : undefined}
            />
          </div>

          <div className="lg:col-span-3 h-full">
            <div
              className="rounded-xl border bg-[var(--color-surface-subtle)] p-5 flex flex-col h-full gap-4"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 items-center">
                <HalfCircleGauge value={loadingVal} color={accentColor} label={label} />
                <div className="flex-1 flex flex-col">
                  <div className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <Layers size={14} /> {t('pillarMagnitudesLabel')}
                  </div>
                  <PillarBars rows={pillars} />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <MetricPill label="Score" value={score != null ? score.toFixed(1) : '—'} color={directionalColor} />
                <MetricPill label="Loading" value={loadingVal != null ? loadingVal.toFixed(1) : '—'} color={accentColor} />
                <MetricPill label="Direction" value={directionValue != null ? formatSigned(directionValue, 2) : '—'} color={directionalColor} />
                <MetricPill label="Confidence" value={confidenceMult != null ? `${confidenceMult.toFixed(2)}×` : '—'} color="var(--color-text-primary)" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">{t('inputBreakdownHeading')}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Compass size={16} /> {t('pillarCompressionLabel')}</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <Row label="Magnitude" value={ctx.compression.magnitude != null ? ctx.compression.magnitude.toFixed(3) : '—'} />
              <Row label="Wall pinch" value={ctx.compression.wallPinch != null ? ctx.compression.wallPinch.toFixed(3) : '—'} />
              <Row label="Flip proximity" value={ctx.compression.flipProximity != null ? ctx.compression.flipProximity.toFixed(3) : '—'} />
              <Row label="Net-GEX mult" value={ctx.compression.netGexMultiplier != null ? `${ctx.compression.netGexMultiplier.toFixed(2)}×` : '—'} />
              <Row label="Call wall" value={ctx.compression.callWall != null ? ctx.compression.callWall.toFixed(2) : '—'} />
              <Row label="Put wall" value={ctx.compression.putWall != null ? ctx.compression.putWall.toFixed(2) : '—'} />
              <Row label="Flip" value={ctx.compression.flip != null ? ctx.compression.flip.toFixed(2) : '—'} />
              <Row label="Spot" value={ctx.compression.spot != null ? ctx.compression.spot.toFixed(2) : '—'} />
              <Row label="Net GEX" value={formatGexCompact(ctx.compression.netGex)} />
            </div>
            <p className="mt-3 pt-2 border-t border-[var(--color-border)]/40 text-[11px] text-[var(--color-text-secondary)]">
              {t('compressionCaption')}
            </p>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Wind size={16} /> {t('cardHedgingTitle')}</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <Row label="Magnitude" value={ctx.hedging.magnitude != null ? ctx.hedging.magnitude.toFixed(3) : '—'} />
              <Row label="Signed" value={formatSigned(ctx.hedging.signed, 3)} />
              <Row label="Vanna" value={formatSigned(ctx.hedging.vanna, 3)} />
              <Row label="Charm" value={formatSigned(ctx.hedging.charm, 3)} />
              <Row label="Charm amp" value={ctx.hedging.charmAmp != null ? `${ctx.hedging.charmAmp.toFixed(2)}×` : '—'} />
              <Row label="Session α (vanna)" value={ctx.hedging.alpha != null ? ctx.hedging.alpha.toFixed(2) : '—'} />
              <Row label="Alignment bonus" value={ctx.hedging.alignmentBonus != null ? `${ctx.hedging.alignmentBonus.toFixed(2)}×` : '—'} />
              <Row label="Dealer DNI" value={formatSigned(ctx.hedging.dealerDni, 3)} />
            </div>
            <p className="mt-3 pt-2 border-t border-[var(--color-border)]/40 text-[11px] text-[var(--color-text-secondary)]">
              <code>α·vanna + (1−α)·charm·charm_amp</code>. {t('hedgingCaptionSuffix')}
            </p>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><ArrowLeftRight size={16} /> {t('cardFlowTitle')}</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <Row label="Magnitude" value={ctx.flow.magnitude != null ? ctx.flow.magnitude.toFixed(3) : '—'} />
              <Row label="Signed" value={formatSigned(ctx.flow.signed, 3)} />
              <Row label="Premium skew (0.6)" value={formatSigned(ctx.flow.premiumSkew, 3)} />
              <Row label="Smart-money skew (0.4)" value={formatSigned(ctx.flow.smartMoneySkew, 3)} />
              <Row label="Total flux" value={formatGexCompact(ctx.flow.totalFlux)} />
              <Row label="Dealer signed" value={formatSigned(ctx.dealer.signed, 3)} />
              <Row label="Dealer net Δ" value={formatGexCompact(ctx.dealer.netDelta)} />
            </div>
            <p className="mt-3 pt-2 border-t border-[var(--color-border)]/40 text-[11px] text-[var(--color-text-secondary)]">
              <code>0.6·premium_skew + 0.4·smart_money_skew</code>. {t('flowCaptionSuffix')}
            </p>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Flame size={16} /> {t('cardTensionTitle')}</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <Row label="Magnitude" value={ctx.tension.magnitude != null ? ctx.tension.magnitude.toFixed(3) : '—'} />
              <Row label="IV rank" value={formatPct(ctx.tension.ivRank, 1, false)} />
              <Row label="Vol squeeze" value={ctx.tension.volSqueeze != null ? ctx.tension.volSqueeze.toFixed(3) : '—'} />
              <Row label="Short σ (10-bar)" value={ctx.tension.shortSigma != null ? ctx.tension.shortSigma.toFixed(4) : '—'} />
              <Row label="Long σ (60-bar)" value={ctx.tension.longSigma != null ? ctx.tension.longSigma.toFixed(4) : '—'} />
            </div>
            <p className="mt-3 pt-2 border-t border-[var(--color-border)]/40 text-[11px] text-[var(--color-text-secondary)]">
              <code>√((1 − iv_rank) · vol_squeeze)</code>. {t('tensionCaptionSuffix')}
            </p>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <ShieldCheck size={18} /> {t('playbookHeading')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
          <PlaybookCard
            band={t('bandDischarged')}
            range="0–24"
            tone={FADE_COLOR}
            description={t('descDischarged')}
          />
          <PlaybookCard
            band={t('bandBuilding')}
            range="25–49"
            tone={FADE_COLOR}
            description={t('descBuilding')}
          />
          <PlaybookCard
            band={t('bandLoaded')}
            range="50–74"
            tone={BULL_COLOR}
            description={t('descLoaded')}
          />
          <PlaybookCard
            band={t('bandCritical')}
            range="75–100"
            tone={BEAR_COLOR}
            description={t('descCritical')}
          />
        </div>
      </section>

      <SignalHowItsBuilt
        caveat={
          <>
            <strong>{t('caveatBandsLabel')}</strong>{' '}
            {t('caveatBody', {
              discharged: t('bandDischarged'),
              building: t('bandBuilding'),
              loaded: t('bandLoaded'),
              critical: t('bandCritical'),
            })}
          </>
        }
      >
        <div>{t('pillarsIntro')}</div>
        <div><code>loading = 100 · C · H<sub>mag</sub> · F<sub>mag</sub> · (0.5 + 0.5·T)</code> {t('loadingFormulaSuffix')}</div>
        <div><code>direction = clamp((0.45·H + 0.40·F·F<sub>mag</sub> + 0.15·dealer) · confidence_mult, ±1)</code> {t('directionFormulaWith')} <code>confidence_mult ∈ [0.7, 1.3]</code> {t('directionFormulaDesc')}</div>
        <div><code>score = sign(direction) · √|direction| · (loading/100)</code> {t('scoreFormulaSuffix')}</div>
        <div>{t('triggersPrefix')} <strong>loading ≥ 50 AND |direction| ≥ 0.20</strong> {t('triggersSuffix')}</div>
      </SignalHowItsBuilt>

      <SignalEventsPanel signalName="market_pressure" symbol={symbol} title={t('eventTimelineTitle')} />
    </PageShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="font-mono text-[var(--color-text-primary)]">{value}</span>
    </div>
  );
}

function MetricPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">{label}</div>
      <div className="text-lg font-black leading-tight" style={{ color }}>{value}</div>
    </div>
  );
}

interface PillarRow {
  key: string;
  label: string;
  magnitude: number | null;
  signed: number | null;
  color: string;
  description: string;
}

function PillarBars({ rows }: { rows: PillarRow[] }) {
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => {
        // Pillar magnitudes are in [0, 1]; render as percent for the bar.
        const magPct = Math.max(0, Math.min(100, (row.magnitude ?? 0) * 100));
        const signLabel = row.signed == null
          ? ''
          : row.signed > 0
            ? ' ↑'
            : row.signed < 0
              ? ' ↓'
              : '';
        return (
          <div key={row.key}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-2 text-[var(--color-text-primary)] font-semibold">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: row.color }} />
                {row.label}
                <span className="text-[10px] font-normal text-[var(--color-text-secondary)] hidden md:inline">{row.description}</span>
              </span>
              <span className="text-[var(--color-text-secondary)] font-mono">
                {row.magnitude != null ? `${row.magnitude.toFixed(2)}${signLabel}` : '—'}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-[var(--color-surface)] overflow-hidden border border-[var(--color-border)]/40">
              <div className="h-full transition-all" style={{ width: `${magPct}%`, background: row.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PlaybookCard({ band, range, tone, description }: { band: string; range: string; tone: string; description: string }) {
  return (
    <div
      className="rounded-xl border bg-[var(--color-surface-subtle)] p-4 flex flex-col gap-2"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: tone }}>{band}</span>
        <span className="text-[10px] font-mono text-[var(--color-text-secondary)] px-1.5 py-0.5 rounded-full border border-[var(--color-border)]">{range}</span>
      </div>
      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{description}</p>
    </div>
  );
}

function HalfCircleGauge({ value, color, label }: { value: number | null; color: string; label: string }) {
  // Semicircle gauge: arc spans 180° from left (0) to right (100). Needle
  // rotates from -90° (full left = 0) to +90° (full right = 100).
  const clamped = value == null ? 0 : Math.max(0, Math.min(100, value));
  const angle = -90 + (clamped / 100) * 180;
  const radius = 60;
  const cx = 80;
  const cy = 80;
  const needleX = cx + radius * Math.sin((angle * Math.PI) / 180);
  const needleY = cy - radius * Math.cos((angle * Math.PI) / 180);
  // Background arc: M (cx-r, cy) → A r,r 0 0 1 (cx+r, cy)
  const arcPath = `M ${cx - radius},${cy} A ${radius},${radius} 0 0 1 ${cx + radius},${cy}`;
  // Filled portion of the arc up to the current value.
  const fillAngleRad = (angle * Math.PI) / 180;
  const fillEndX = cx + radius * Math.sin(fillAngleRad);
  const fillEndY = cy - radius * Math.cos(fillAngleRad);
  const largeArc = 0; // 180° max, never large arc
  const filledPath = value == null
    ? ''
    : `M ${cx - radius},${cy} A ${radius},${radius} 0 ${largeArc} 1 ${fillEndX},${fillEndY}`;

  return (
    <div className="flex flex-col items-center select-none">
      <svg viewBox="0 0 160 100" width={160} height={100} aria-hidden="true">
        <path d={arcPath} fill="none" stroke="var(--color-border)" strokeWidth={10} strokeLinecap="round" />
        {filledPath && (
          <path d={filledPath} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" />
        )}
        {value != null && (
          <line
            x1={cx}
            y1={cy}
            x2={needleX}
            y2={needleY}
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        )}
        <circle cx={cx} cy={cy} r={4} fill={color} />
        <text x={cx - radius} y={cy + 14} fontSize={9} fill="var(--color-text-secondary)" textAnchor="middle">0</text>
        <text x={cx + radius} y={cy + 14} fontSize={9} fill="var(--color-text-secondary)" textAnchor="middle">100</text>
      </svg>
      <div className="-mt-3 text-center">
        <div className="text-2xl font-black leading-none" style={{ color }}>
          {value != null ? value.toFixed(1) : '—'}
        </div>
        <div className="mt-1 inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: `${color}1f`, color }}>
          {label}
        </div>
      </div>
    </div>
  );
}
