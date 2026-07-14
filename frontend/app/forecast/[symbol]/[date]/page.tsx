import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, CheckCircle2, XCircle, Ruler, Gauge, Layers } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import ShareCardButton from '@/components/ShareCardButton';
import SymbolPicker from '@/components/SymbolPicker';
import { buildSymbolHrefs, resolveSymbol } from '@/core/symbols';
import { serverApiGet } from '@/core/api/serverFetch';

// Public permalink for one trading day's Gamma Forecast Card.
//
// Dual state:
//   * Morning (07:00 ET): projected range + expected-volatility call + key
//     levels with touch odds + flagship Playbook setup. Immutable until 4:01 PM.
//   * Receipt (16:05 ET): same URL re-renders with actual L/H/C overlaid
//     against the morning band, plus verdicts on each claim (range coverage,
//     realized-vs-implied volatility, and per-level touch/flip outcomes).
//
// The card deliberately forecasts NO direction. It commits to three things
// gamma structure conditions and that grade objectively on the day's OHLC:
// how far price can travel (range), how much it actually moves vs. implied
// (volatility), and which dealer lines it reaches (levels).
//
// Server-rendered; ISR-cached for 30 minutes (the receipt arrives at
// 16:05 ET and we want the page to flip within an hour at most).
const REVALIDATE_SECONDS = 1800;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://zerogex.io').replace(/\/+$/, '');

// A rolling hit rate over a handful of receipts is noise — with n=1 each claim
// can only read 0% or 100%. Below this many *graded* receipts we show a
// "building history" note instead of the percentage tiles, so a freshly-seeded
// symbol (or one whose history was just pruned) doesn't advertise a hollow
// track record.
const MIN_SCORED_FOR_RATES = 5;

interface ForecastMorning {
  ts: string | null;
  open_spot: number | null;
  call_wall: number | null;
  put_wall: number | null;
  gamma_flip: number | null;
  open_msi: number | null;
  regime: string | null;
  projected_low: number | null;
  projected_high: number | null;
  projected_close: number | null;
  // v1.4 gradeable claims — the tiles that replace pin/regime.
  expected_vol_state: string | null;
  expected_vol_ratio: number | null;
  implied_move: number | null;
  flip_cross_prob: number | null;
  level_touch_probs: Record<string, number> | null;
  gravity_center: number | null;
  flagship_setup: Record<string, unknown> | null;
  range_model: string | null;
  content_hash: string | null;
}

interface ForecastReceipt {
  ts: string | null;
  actual_low: number | null;
  actual_high: number | null;
  actual_close: number | null;
  range_respected: boolean | null;
  // v1.4 verdicts.
  realized_vol_ratio: number | null;
  vol_state_correct: boolean | null;
  flip_crossed: boolean | null;
  level_touch_outcomes: Record<string, boolean> | null;
  levels_brier: number | null;
  setup_outcome: Record<string, unknown> | null;
}

interface ForecastPayload {
  symbol: string;
  date: string;
  morning: ForecastMorning;
  receipt: ForecastReceipt | null;
}

interface RollingStats {
  symbol: string;
  window: number;
  n_scored: number;
  range_respected_rate: number | null;
  vol_state_correct_rate: number | null;
  vol_n_scored: number;
  levels_brier_avg: number | null;
  levels_n_scored: number;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(raw: string): boolean {
  if (!ISO_DATE.test(raw)) return false;
  return Number.isFinite(Date.parse(`${raw}T00:00:00Z`));
}

function formatHumanDate(raw: string): string {
  try {
    const dt = new Date(`${raw}T12:00:00Z`);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(dt);
  } catch {
    return raw;
  }
}

// Snake-case enum → Title Case ("compression" → "Compression").
function humanize(value: string | null): string {
  if (!value) return 'Unknown';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function fmtPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `$${value.toFixed(2)}`;
}

function fmtPct(rate: number | null): string {
  if (rate == null) return '—';
  return `${(rate * 100).toFixed(0)}%`;
}

// Expected-vol ratio → "≈65% of implied" (the realized range the model expects
// relative to the VIX-implied 1-day move).
function fmtRatioOfImplied(ratio: number | null): string {
  if (ratio == null || !Number.isFinite(ratio)) return '—';
  return `≈${(ratio * 100).toFixed(0)}% of implied`;
}

async function loadForecast(day: string, symbol: string): Promise<ForecastPayload | null> {
  const qs = new URLSearchParams({ symbol }).toString();
  return serverApiGet<ForecastPayload>(`/api/forecast/${day}?${qs}`, REVALIDATE_SECONDS);
}

async function loadStats(symbol: string): Promise<RollingStats | null> {
  return serverApiGet<RollingStats>(
    `/api/forecast/stats/rolling?symbol=${symbol}&window=30`,
    REVALIDATE_SECONDS,
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string; date: string }>;
}): Promise<Metadata> {
  const { symbol, date } = await params;
  const sym = resolveSymbol(symbol);
  if (!isValidDate(date)) {
    return { title: 'Forecast not found — ZeroGEX', robots: { index: false, follow: false } };
  }
  const data = await loadForecast(date, sym);
  const human = formatHumanDate(date);
  const url = `${SITE_URL}/forecast/${sym}/${date}`;
  const hasReceipt = data?.receipt != null;
  const titleHead = hasReceipt ? 'Receipt' : 'Forecast';
  const title = data
    ? `${sym} · ${human} ${titleHead} — ZeroGEX`
    : `${sym} · ${human} Forecast — ZeroGEX`;
  const description = data
    ? hasReceipt
      ? `Receipt for ${sym} on ${human}. Range ${data.receipt!.range_respected ? '✓ held' : '✗ broken'} · Volatility ${data.receipt!.vol_state_correct ? '✓' : '✗'}.`
      : `${sym} morning forecast: range ${fmtPrice(data.morning.projected_low)}–${fmtPrice(data.morning.projected_high)}, ${humanize(data.morning.expected_vol_state)} volatility, key gamma levels with touch odds. No direction call.`
    : 'Daily ZeroGEX Gamma Forecast Card — 7 AM commitment, 4 PM receipt.';
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title,
      description,
      siteName: 'ZeroGEX',
      images: [{ url: `${url}/opengraph-image`, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${url}/opengraph-image`],
    },
  };
}

export default async function ForecastPage({
  params,
}: {
  params: Promise<{ symbol: string; date: string }>;
}) {
  const { symbol, date } = await params;
  const sym = resolveSymbol(symbol);
  if (!isValidDate(date)) notFound();
  const [data, stats] = await Promise.all([loadForecast(date, sym), loadStats(sym)]);
  if (!data) notFound();

  const morning = data.morning;
  const receipt = data.receipt;
  const human = formatHumanDate(date);
  const volLabel = humanize(morning.expected_vol_state);
  const permalink = `${SITE_URL}/forecast/${sym}/${date}`;
  const pickerHrefs = buildSymbolHrefs((s) => `/forecast/${s}/${date}`);
  const tweetBody = receipt
    ? `${sym} ${date} receipt — range ${receipt.range_respected ? 'held' : 'broken'}, volatility ${receipt.vol_state_correct ? 'called' : 'missed'} (${fmtRatioOfImplied(receipt.realized_vol_ratio)}).`
    : `${sym} ${date} forecast — range ${fmtPrice(morning.projected_low)}–${fmtPrice(morning.projected_high)}, ${volLabel.toLowerCase()} volatility, key levels with touch odds. No direction call.`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Link
            href={sym === 'SPY' ? '/forecast' : `/forecast?symbol=${sym}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            <ChevronLeft size={14} /> Forecasts
          </Link>
          <span className="text-[var(--color-border)]" aria-hidden="true">·</span>
          <Link
            href="/spx-gamma-levels"
            className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            Gamma Levels
          </Link>
        </div>
        <ShareCardButton
          cardId={`${sym}:${date}`}
          tweetText={tweetBody}
          cardUrl={permalink}
          eventName="forecast_share_clicked"
        />
      </div>

      <header className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
              ZeroGEX · {receipt ? 'Forecast Receipt' : 'Morning Forecast'}
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              {sym} · {human}
            </h1>
            <p className="mt-1 font-mono text-xs text-[var(--color-text-secondary)]">
              {receipt
                ? `Committed ${morning.ts} · Receipt ${receipt.ts}`
                : `Committed ${morning.ts} · receipt at 4:05 PM ET`}
            </p>
          </div>
          <SymbolPicker current={sym} hrefs={pickerHrefs} />
        </div>
      </header>

      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* 1 — Expected range (kept). Containment: how far price can travel. */}
        <Stat
          label="Expected range"
          value={`${fmtPrice(morning.projected_low)} – ${fmtPrice(morning.projected_high)}`}
          accent="var(--color-accent)"
          icon={Ruler}
          verdict={receipt ? (receipt.range_respected ? 'held' : 'broken') : null}
          hint={(() => {
            const parts: string[] = [];
            if (
              morning.open_spot != null
              && morning.projected_low != null
              && morning.projected_high != null
              && Number.isFinite(morning.open_spot)
              && morning.open_spot > 0
            ) {
              const downPct = ((morning.open_spot - morning.projected_low) / morning.open_spot) * 100;
              const upPct = ((morning.projected_high - morning.open_spot) / morning.open_spot) * 100;
              parts.push(`−${downPct.toFixed(2)}% / +${upPct.toFixed(2)}%`);
            }
            if (receipt) {
              parts.push(`Actual: ${fmtPrice(receipt.actual_low)} – ${fmtPrice(receipt.actual_high)}`);
            } else {
              parts.push('Walls · VIX/VXN · ATR blend · 90% coverage target');
            }
            return parts.join(' · ');
          })()}
        />

        {/* 2 — Expected volatility (replaces Regime). Energy: how much it moves. */}
        <Stat
          label="Expected volatility"
          value={volLabel}
          accent="var(--color-accent)"
          icon={Gauge}
          verdict={
            receipt && receipt.vol_state_correct != null
              ? receipt.vol_state_correct ? 'held' : 'broken'
              : null
          }
          hint={(() => {
            if (receipt) {
              if (receipt.realized_vol_ratio == null) return 'Not graded — no implied move on file';
              const verb = receipt.vol_state_correct ? 'as called' : 'off the call';
              return `Realized ${fmtRatioOfImplied(receipt.realized_vol_ratio)} — ${verb}`;
            }
            const parts: string[] = [fmtRatioOfImplied(morning.expected_vol_ratio)];
            if (morning.flip_cross_prob != null) {
              parts.push(`flip-cross ${fmtPct(morning.flip_cross_prob)}`);
            }
            parts.push('graded on realized ÷ implied');
            return parts.join(' · ');
          })()}
        />

        {/* 3 — Key levels (replaces Pin). Geography: which lines it reaches. */}
        <Stat
          label="Key levels"
          value={(() => {
            const n =
              Object.keys(morning.level_touch_probs ?? {}).length
              + (morning.flip_cross_prob != null ? 1 : 0);
            return n > 0 ? `${n} in play` : '—';
          })()}
          accent="var(--color-accent)"
          icon={Layers}
          verdict={null}
          hint={(() => {
            if (receipt) {
              return receipt.levels_brier != null
                ? `Brier ${receipt.levels_brier.toFixed(2)} · outcomes on the ladder below`
                : 'Outcomes on the ladder below';
            }
            const parts: string[] = ['Touch odds on the ladder below'];
            if (morning.gravity_center != null) {
              parts.push(`gravity ${fmtPrice(morning.gravity_center)} while long-γ`);
            }
            return parts.join(' · ');
          })()}
        />
      </section>

      {/* Levels ladder — the geography claim, made visual. Upgrades the old
          plain anchors row into per-line touch odds (morning) / outcomes (receipt). */}
      <LevelsLadder morning={morning} receipt={receipt} />

      {/* The thesis, stated on the card itself. */}
      <section
        className="mb-8 rounded-xl border-2 px-5 py-4"
        style={{ borderColor: 'var(--color-accent)', background: 'var(--color-accent-soft)' }}
      >
        <div className="text-sm font-bold">
          We do <span style={{ color: 'var(--color-accent)' }}>not</span> forecast which way {sym} goes.
        </div>
        <div className="mt-1 text-xs text-[var(--color-text-secondary)] leading-relaxed">
          Three claims — how far price can travel (range), how much it actually moves versus what&rsquo;s
          priced in (volatility), and which dealer lines it reaches (levels). Gamma structure conditions
          all three. Direction it does not.
        </div>
      </section>

      {morning.flagship_setup && (
        <section className="mb-8 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
          <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
            Flagship Playbook setup
          </div>
          <div className="mt-1 text-xl font-black tracking-tight">
            {humanize(String(morning.flagship_setup.action ?? '—'))}
          </div>
          {typeof morning.flagship_setup.pattern === 'string' && (
            <div className="mt-1 font-mono text-xs text-[var(--color-text-secondary)]">
              {humanize(morning.flagship_setup.pattern)}
            </div>
          )}
          {typeof (morning.flagship_setup as { id?: number }).id === 'number' && (
            <Link
              href={`/cards/${(morning.flagship_setup as { id: number }).id}`}
              className="mt-2 inline-block text-xs underline text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              View full Action Card permalink ↗
            </Link>
          )}
        </section>
      )}

      {stats && stats.n_scored > 0 && (
        <section className="mb-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
          <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)] mb-3">
            {stats.n_scored >= MIN_SCORED_FOR_RATES
              ? `Rolling ${stats.window}-day track record (n=${stats.n_scored})`
              : `Rolling ${stats.window}-day track record`}
          </div>
          {stats.n_scored >= MIN_SCORED_FOR_RATES ? (
            <div className="grid grid-cols-3 gap-3 text-center">
              <HitRate label="Range respected" rate={stats.range_respected_rate} />
              <HitRate label="Volatility called" rate={stats.vol_state_correct_rate} />
              <BrierStat label="Levels Brier" value={stats.levels_brier_avg} />
            </div>
          ) : (
            <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Building history — {stats.n_scored} graded{' '}
              {stats.n_scored === 1 ? 'receipt' : 'receipts'} so far. A rolling hit rate needs at
              least {MIN_SCORED_FOR_RATES} graded days to mean anything, so we hold it back until
              then rather than show a rate a single session could swing to 0% or 100%.
            </div>
          )}
        </section>
      )}

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5 text-xs text-[var(--color-text-secondary)] leading-relaxed">
        <div className="mb-1 text-[10px] uppercase tracking-[0.22em] font-bold">About this forecast</div>
        Daily commitment for {sym} written at 7:00 AM ET, hashed and immutable. The projected range is
        anchored on the open spot and bounded by the GEX call/put walls with a safety expansion (event
        days get a 1.5× stretch); it&rsquo;s graded on <em>coverage</em> — an 80–90% band should contain
        the day that often. Expected volatility is realized daily range as a fraction of the VIX-implied
        move — long gamma damps it (compression), short gamma amplifies it (expansion) — and is graded on
        realized ÷ implied, so a round-trip trend day that closes flat still reads as expansion. Key
        levels carry the reflection-principle odds that price reaches each wall and crosses the gamma flip
        today, graded by Brier score. The receipt is written once at 4:05 PM ET from the day&rsquo;s
        actual cash-session OHLC and is immutable thereafter.
        <br />
        <br />
        Model: <span className="font-mono">{morning.range_model ?? 'heuristic_v1'}</span>
        {morning.content_hash && (
          <>
            {' '}· hash <span className="font-mono">{morning.content_hash.slice(0, 12)}</span>
          </>
        )}
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
  verdict,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  accent: string;
  verdict: 'held' | 'broken' | null;
  hint?: string | null;
  icon?: LucideIcon;
}) {
  const VerdictIcon =
    verdict === 'held' ? CheckCircle2 : verdict === 'broken' ? XCircle : null;
  const verdictColor =
    verdict === 'held' ? 'var(--color-bull)' : verdict === 'broken' ? 'var(--color-bear)' : null;
  return (
    <div className="rounded-xl border-2 bg-[var(--color-surface)] px-4 py-4" style={{ borderColor: accent }}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
        {Icon ? <Icon size={11} /> : null}
        {label}
      </div>
      <div className="mt-1 flex items-center gap-2 text-xl font-black tracking-tight" style={{ color: accent }}>
        {value}
        {VerdictIcon && verdictColor && (
          <VerdictIcon size={20} style={{ color: verdictColor }} />
        )}
      </div>
      {hint && <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">{hint}</div>}
    </div>
  );
}

interface LadderRow {
  key: string;
  name: string;
  tag: string;
  tagColor: string;
  price: number;
  kind: 'wall' | 'flip' | 'gravity' | 'spot';
  prob: number | null;
  outcome: boolean | null;
}

// The levels ladder: every dealer line ordered by price (high → low), each with
// its committed touch/flip odds (morning) or realized outcome (receipt). The
// max-gamma gravity line and the open-spot marker carry no probability.
function LevelsLadder({
  morning,
  receipt,
}: {
  morning: ForecastMorning;
  receipt: ForecastReceipt | null;
}) {
  const probs = morning.level_touch_probs ?? {};
  const outcomes = receipt?.level_touch_outcomes ?? {};

  const rows: LadderRow[] = [];
  if (morning.call_wall != null) {
    rows.push({
      key: 'call_wall', name: 'Call wall', tag: 'resistance', tagColor: 'var(--color-bear)',
      price: morning.call_wall, kind: 'wall',
      prob: probs.call_wall ?? null, outcome: outcomes.call_wall ?? null,
    });
  }
  if (morning.open_spot != null) {
    rows.push({
      key: 'spot', name: 'Open spot', tag: '', tagColor: '',
      price: morning.open_spot, kind: 'spot', prob: null, outcome: null,
    });
  }
  if (morning.gravity_center != null) {
    rows.push({
      key: 'gravity', name: 'Max-gamma', tag: 'gravity', tagColor: 'var(--color-accent)',
      price: morning.gravity_center, kind: 'gravity', prob: null, outcome: null,
    });
  }
  if (morning.gamma_flip != null) {
    rows.push({
      key: 'gamma_flip', name: 'Gamma flip', tag: 'regime line', tagColor: 'var(--color-text-secondary)',
      price: morning.gamma_flip, kind: 'flip',
      prob: morning.flip_cross_prob, outcome: outcomes.gamma_flip ?? null,
    });
  }
  if (morning.put_wall != null) {
    rows.push({
      key: 'put_wall', name: 'Put wall', tag: 'support', tagColor: 'var(--color-bull)',
      price: morning.put_wall, kind: 'wall',
      prob: probs.put_wall ?? null, outcome: outcomes.put_wall ?? null,
    });
  }
  if (rows.length === 0) return null;
  rows.sort((a, b) => b.price - a.price);

  return (
    <section className="mb-8 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
          <Layers size={11} /> Levels &amp; touch odds
        </div>
        <div className="text-[10px] text-[var(--color-text-secondary)]">
          {receipt ? 'forecast vs. what happened' : 'P(price reaches this line today)'}
        </div>
      </div>
      <div className="flex flex-col">
        {rows.map((row) => (
          <LadderRowView key={row.key} row={row} hasReceipt={receipt != null} close={receipt?.actual_close ?? null} />
        ))}
      </div>
    </section>
  );
}

function LadderRowView({
  row,
  hasReceipt,
  close,
}: {
  row: LadderRow;
  hasReceipt: boolean;
  close: number | null;
}) {
  const isSpot = row.kind === 'spot';
  // "Called well" = the committed probability leaned the right way (≥50% and it
  // happened, or <50% and it didn't). Colors the receipt outcome bull/bear.
  const calledWell =
    row.prob != null && row.outcome != null ? (row.prob >= 0.5) === row.outcome : null;
  const outcomeColor =
    calledWell == null ? 'var(--color-text-secondary)' : calledWell ? 'var(--color-bull)' : 'var(--color-bear)';
  const outcomeText = (() => {
    if (row.outcome == null) return null;
    if (row.kind === 'flip') return row.outcome ? 'crossed' : 'no cross';
    return row.outcome ? 'reached' : 'not reached';
  })();

  return (
    <div
      className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,1.6fr)] items-center gap-3 border-b border-[var(--color-border)] py-2.5 last:border-b-0"
      style={isSpot ? { background: 'var(--color-accent-soft)' } : undefined}
    >
      <div className="flex items-center gap-2 text-[13px] font-semibold">
        {row.name}
        {row.tag && (
          <span
            className="rounded border px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.08em]"
            style={{ color: row.tagColor, borderColor: row.tagColor }}
          >
            {row.tag}
          </span>
        )}
      </div>
      <div className="text-right font-mono text-sm font-semibold tabular-nums">
        {fmtPrice(row.price)}
      </div>
      <div className="flex items-center justify-end gap-2">
        {hasReceipt ? (
          isSpot ? (
            <span className="font-mono text-[11px] text-[var(--color-text-secondary)] tabular-nums">
              closed {fmtPrice(close)}
            </span>
          ) : outcomeText ? (
            <span className="text-[12px] font-bold" style={{ color: outcomeColor }}>
              {row.prob != null ? `${fmtPct(row.prob)} → ` : ''}{outcomeText}
            </span>
          ) : row.kind === 'gravity' ? (
            <span className="text-[11px] text-[var(--color-text-secondary)]">pull center (long-γ)</span>
          ) : (
            <span className="text-[11px] text-[var(--color-text-secondary)]">—</span>
          )
        ) : isSpot ? (
          <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--color-accent)' }}>
            — you are here —
          </span>
        ) : row.kind === 'gravity' ? (
          <span className="text-[11px] text-[var(--color-text-secondary)]">pull center while long-γ</span>
        ) : row.prob != null ? (
          <>
            <div className="h-1.5 w-full max-w-[140px] overflow-hidden rounded-full" style={{ background: 'var(--color-surface-subtle)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.round(row.prob * 100)}%`,
                  background: row.kind === 'flip' ? 'var(--color-warning)' : 'var(--color-accent)',
                }}
              />
            </div>
            <span className="w-10 text-right font-mono text-[12px] font-semibold tabular-nums text-[var(--color-text-secondary)]">
              {fmtPct(row.prob)}
            </span>
          </>
        ) : (
          <span className="text-[11px] text-[var(--color-text-secondary)]">—</span>
        )}
      </div>
    </div>
  );
}

function HitRate({ label, rate }: { label: string; rate: number | null }) {
  const color =
    rate == null ? 'var(--color-text-secondary)' :
    rate >= 0.7 ? 'var(--color-bull)' :
    rate >= 0.5 ? 'var(--color-warning)' :
    'var(--color-bear)';
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
        {label}
      </div>
      <div className="mt-1 font-mono text-xl font-bold" style={{ color }}>
        {fmtPct(rate)}
      </div>
    </div>
  );
}

// Brier score: lower is better (0 = perfect calibration, 0.25 = a coin flip).
function BrierStat({ label, value }: { label: string; value: number | null }) {
  const color =
    value == null ? 'var(--color-text-secondary)' :
    value <= 0.15 ? 'var(--color-bull)' :
    value <= 0.25 ? 'var(--color-warning)' :
    'var(--color-bear)';
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
        {label}
      </div>
      <div className="mt-1 font-mono text-xl font-bold" style={{ color }}>
        {value == null ? '—' : value.toFixed(2)}
      </div>
    </div>
  );
}
