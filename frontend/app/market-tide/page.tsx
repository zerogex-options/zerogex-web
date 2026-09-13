"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Activity, Gauge, RefreshCw, Users } from "lucide-react";
import PageShell from "@/components/layout/PageShell";
import PageHeader from "@/components/layout/PageHeader";
import { FilterBar, FilterChip, FilterGroup } from "@/components/controls/Filters";
import ErrorMessage from "@/components/ErrorMessage";
import TooltipWrapper from "@/components/TooltipWrapper";
import { formatEtDate, formatEtTime } from "@/core/signalHelpers";
import { useApiData } from "@/hooks/useApiData";
import MarketTideChart from "./MarketTideChart";
import FlowGammaMap from "./FlowGammaMap";
import {
  breadthWidths,
  buildRead,
  finite,
  formatLabel,
  formatNumber,
  formatSigned,
  markerPosition,
  safePercent,
  tideComponents,
  type MarketTideComponent,
  type MarketTideHistoryMode,
  type MarketTideHistoryResponse,
  type MarketTideResponse,
} from "./data";

// Compose the app's existing ET timestamp formatters (from core/signalHelpers)
// for the "Last updated" line, matching the sibling signal pages, with a
// defensive fallback when the backend timestamp is missing or unparseable.
function formatUpdated(value: unknown): string {
  const date = formatEtDate(value);
  if (!date) return "Unavailable";
  return `${date}, ${formatEtTime(value)} ET`;
}

const WINDOWS = [5, 15, 30, 60] as const;
// The page's surfaces are the site's one panel. `cardStyle` stays as an empty
// passthrough rather than being deleted from nine call sites at once.
const card = "zg-panel p-5 sm:p-6";
const cardStyle = undefined;
const border = { borderColor: "var(--border-default)" };

function MetricTitle({ children, tip }: { children: React.ReactNode; tip: string }) {
  return (
    <div className="zg-eyebrow flex items-center gap-2">
      {children}
      <TooltipWrapper text={tip} />
    </div>
  );
}

// ── Score + gamma readout with the −100..100 meter ──
function ScorePanel({ data }: { data: MarketTideResponse }) {
  const insufficient = data.score === null || data.label === "insufficient_data";
  const score = finite(data.score);
  const position = insufficient ? null : markerPosition(data.score);
  const bull = score != null && score >= 0;
  const gammaLabel = data.gamma_label;
  const gammaTone =
    gammaLabel === "amplifying"
      ? "var(--color-bear)"
      : gammaLabel === "dampening"
        ? "var(--color-bull)"
        : "var(--text-secondary)";
  return (
    <section className={`${card} flex flex-col`} style={cardStyle} aria-labelledby="tide-score-title">
      <MetricTitle tip="Cross-market options pressure adjusted for the dealer gamma regime, on a −100 (bearish) to +100 (bullish) scale.">
        <span id="tide-score-title">Tide Score</span>
      </MetricTitle>
      <div className="mt-3" {...(insufficient ? { role: "img", "aria-label": "Tide score: Insufficient Data." } : {})}>
        <div className="text-6xl font-bold tabular-nums leading-none" style={{ color: insufficient ? "var(--text-primary)" : bull ? "var(--color-bull)" : "var(--color-bear)" }}>
          {insufficient || score == null ? "—" : formatSigned(score, 1)}
        </div>
        <div className="mt-2 text-sm font-semibold uppercase tracking-[.14em]" style={{ color: insufficient ? "var(--text-secondary)" : bull ? "var(--color-bull)" : "var(--color-bear)" }}>
          {insufficient ? "Score withheld" : formatLabel(data.label)}
        </div>
      </div>

      {insufficient ? (
        <p className="mt-4 text-sm text-[var(--text-secondary)]">
          The Market Tide score is withheld until at least 60% of supported indices have fresh gamma and flow data.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="text-[var(--text-secondary)]">Dealer gamma</span>
          <span className="zg-chip" style={{ "--chip-color": gammaTone } as CSSProperties}>
            {formatLabel(gammaLabel)}
          </span>
          <span className="text-[var(--text-secondary)]">
            {gammaLabel === "amplifying" ? "· moves get amplified" : gammaLabel === "dampening" ? "· moves get absorbed" : "· roughly neutral"}
          </span>
        </div>
      )}

      {!insufficient && score != null && position != null && (
        <div
          className="mt-auto pt-6"
          role="meter"
          aria-label="Market Tide score, bearish to bullish"
          aria-valuemin={-100}
          aria-valuemax={100}
          aria-valuenow={score}
          aria-valuetext={`${formatNumber(score, 1)}, ${formatLabel(data.label)}`}
        >
          <div className="relative h-2.5 rounded-full bg-gradient-to-r from-[var(--color-bear)] via-[var(--border-default)] to-[var(--color-bull)]">
            <span className="absolute left-1/2 top-[-4px] h-4.5 w-px bg-[var(--text-muted)]" aria-hidden="true" />
            <span
              data-testid="gauge-marker"
              className="absolute top-1/2 h-5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--bg-card)] bg-[var(--text-primary)] motion-reduce:transition-none"
              style={{ left: `${position}%` }}
              aria-hidden="true"
            />
          </div>
          <div className="mt-2 flex justify-between text-xs font-medium text-[var(--text-secondary)]">
            <span>Bearish</span>
            <span>Neutral</span>
            <span>Bullish</span>
          </div>
        </div>
      )}
    </section>
  );
}

// ── The Tide chart card (Today / Trend), fed by the history endpoint ──
function TideCard({ windowMinutes }: { windowMinutes: number }) {
  const [mode, setMode] = useState<MarketTideHistoryMode>("intraday");
  const query = `/api/flow/market-tide/history?window=${windowMinutes}&mode=${mode}${mode === "daily" ? "&days=30" : ""}`;
  const { data } = useApiData<MarketTideHistoryResponse>(query, { refreshInterval: 30_000 });
  const points = useMemo(() => (Array.isArray(data?.points) ? data!.points : []), [data]);
  const last = points[points.length - 1];
  // Resolve "is the tape live" from a clock advanced in an effect (never read
  // Date.now() during render — it's impure). The last point is live-fresh when
  // it's within 15 min of now; after the close it holds (frozen) and the ping
  // drops away.
  const [nowMs, setNowMs] = useState(0);
  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  const live =
    mode === "intraday" && last != null && nowMs > 0
      ? nowMs - new Date(last.timestamp).getTime() < 15 * 60 * 1000
      : false;

  return (
    <section className={`${card} lg:col-span-2`} style={cardStyle} aria-label="The Tide over time">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MetricTitle tip="Market-wide flow score over time. Flow floods green above zero (net bullish) and ebbs red below (net bearish). Frozen at the 16:00 ET close after hours.">
          The Tide
        </MetricTitle>
        <FilterBar>
          {(["intraday", "daily"] as const).map((m) => (
            <FilterChip key={m} active={mode === m} onClick={() => setMode(m)}>
              {m === "intraday" ? "Today" : "30-day trend"}
            </FilterChip>
          ))}
        </FilterBar>
      </div>
      <div className="mt-4">
        <MarketTideChart points={points} mode={mode} live={live} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-[var(--text-secondary)]">
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-[3px] w-3 rounded" style={{ background: "var(--color-bull)" }} /> Flood · bullish flow</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-[3px] w-3 rounded" style={{ background: "var(--color-bear)" }} /> Ebb · bearish flow</span>
        <span className="text-[var(--text-muted)]">Zero = balanced tape</span>
      </div>
    </section>
  );
}

// ── The Read — the numbers as plain english ──
function ReadCard({ data }: { data: MarketTideResponse }) {
  const read = buildRead(data);
  const accentVar: Record<string, string> = {
    bull: "var(--color-bull)",
    bear: "var(--color-bear)",
    gold: "var(--color-gold)",
    hot: "var(--color-accent-hot)",
  };
  return (
    <section className={card} style={cardStyle} aria-label="The Read">
      <MetricTitle tip="A plain-english interpretation generated from the current reading.">The Read</MetricTitle>
      {!read || read.items.length === 0 ? (
        <p className="mt-4 text-[var(--text-secondary)]">{read?.headline ?? "Not enough data to publish a read yet."}</p>
      ) : (
        <>
          <h3 className="mt-3 text-lg font-semibold leading-snug text-balance">{read.headline}</h3>
          <div className="mt-4 flex flex-col gap-3">
            {read.items.map((it, i) => (
              <div key={i} className="flex gap-3 text-sm text-[var(--text-secondary)]">
                <span
                  className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded font-mono text-xs font-bold"
                  style={{ color: accentVar[it.accent], background: `color-mix(in srgb, ${accentVar[it.accent]} 12%, transparent)` }}
                  aria-hidden="true"
                >
                  {it.icon}
                </span>
                <p>
                  <b className="font-semibold text-[var(--text-primary)]">{it.label}.</b> {it.body}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// ── By-ticker strip (replaces the dense contributor tables) ──
function ByTickerStrip({ rows }: { rows: MarketTideComponent[] }) {
  if (rows.length === 0) {
    return (
      <p className="border border-dashed p-6 text-center text-sm text-[var(--text-secondary)]" style={{ ...border, borderRadius: "var(--radius-panel)" }}>
        No eligible symbols in this window.
      </p>
    );
  }
  return (
    <div>
      {rows.map((c, i) => {
        const flow = finite(c.flow_score) ?? 0;
        const short = (finite(c.gamma_score) ?? 0) < 0;
        const contrib = finite(c.contribution) ?? 0;
        const weight = finite(c.weight) ?? 0;
        const mag = Math.min(1, Math.abs(flow)) * 50;
        const bull = flow >= 0;
        return (
          <div
            key={`${c.symbol}-${i}`}
            className="grid grid-cols-[56px_1fr_auto] items-center gap-3 border-t py-3 first:border-t-0 sm:grid-cols-[64px_1fr_150px_92px] sm:gap-4"
            style={border}
          >
            <div className="font-mono font-bold">{c.symbol || "—"}</div>
            <div className="relative h-6 overflow-hidden rounded" style={{ background: "var(--bg-subtle)" }}>
              <span className="absolute inset-y-0 left-1/2 w-px" style={{ background: "var(--border-strong)" }} />
              <span
                className="absolute inset-y-1 rounded-sm"
                style={{ background: bull ? "var(--color-bull)" : "var(--color-bear)", width: `${mag}%`, ...(bull ? { left: "50%" } : { right: "50%" }) }}
              />
              <span className="absolute top-1/2 -translate-y-1/2 font-mono text-[10.5px] text-[var(--text-secondary)]" style={bull ? { right: 8 } : { left: 8 }}>
                {bull ? "call-led" : "put-led"} {formatNumber(flow, 2)}
              </span>
            </div>
            <div className="hidden sm:block">
              <span
                className="zg-chip whitespace-nowrap"
                style={{
                  "--chip-color": short ? "var(--color-bear)" : "var(--color-bull)",
                  background: short ? "var(--color-bear-soft)" : "var(--color-bull-soft)",
                } as CSSProperties}
              >
                {short ? "short γ · amplifies" : "long γ · pins"}
              </span>
            </div>
            <div className="text-right">
              <div className="font-mono font-semibold tabular-nums" style={{ color: contrib >= 0 ? "var(--color-bull)" : "var(--color-bear)" }}>
                {formatSigned(contrib, 2)}
              </div>
              <div className="hidden font-mono text-[10px] text-[var(--text-muted)] sm:block">wt {formatNumber(weight * 100, 0)}%</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MarketTideSkeleton() {
  return (
    <div data-testid="market-tide-skeleton" className="space-y-6 animate-pulse motion-reduce:animate-none" aria-label="Loading Market Tide">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-64 zg-skeleton-line" />
        <div className="h-64 zg-skeleton-line lg:col-span-2" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[1, 2].map((x) => (
          <div key={x} className="h-72 zg-skeleton-line" />
        ))}
      </div>
    </div>
  );
}

export default function MarketTidePage() {
  const [windowMinutes, setWindowMinutes] = useState<(typeof WINDOWS)[number]>(15);
  const { data, loading, error, refetch } = useApiData<MarketTideResponse>(
    `/api/flow/market-tide?window=${windowMinutes}`,
    { refreshInterval: 30_000 },
  );
  const flow = finite(data?.flow_direction);
  const gamma = finite(data?.gamma_regime);
  const participation = safePercent(data?.participation_pct);
  const breadth = breadthWidths([data?.bullish_breadth_pct, data?.neutral_breadth_pct, data?.bearish_breadth_pct]);
  const gammaLabel = formatLabel(data?.gamma_label);
  const gammaCopy =
    data?.gamma_label === "amplifying"
      ? "Negative gamma can strengthen moves in the direction of options pressure."
      : data?.gamma_label === "dampening"
        ? "Positive gamma can absorb or moderate directional options pressure."
        : "Dealer gamma is not materially amplifying or dampening options pressure.";
  const components = tideComponents(data);

  return (
    <PageShell width="wide" className="space-y-6">
      <PageHeader
        title="Market Tide"
        beta
        sub="Where market-wide option money is flowing, and whether dealer gamma will amplify or absorb it."
        tooltip="Every other page here reads one symbol. This reads every index we track at once and scores the aggregate on a −100 to +100 scale, then adjusts that score for the dealer gamma regime behind it — the same flow means something different when dealers are short gamma and amplifying moves than when they are long it and pinning. Breadth says how much of the market agrees with the headline number; participation says how much of it is reporting at all, which is the figure to check first when a reading looks extreme. The window sets how much recent tape the score is computed over."
        actions={
          <FilterBar>
            <FilterGroup label="Window">
              {WINDOWS.map((value) => (
                <FilterChip
                  key={value}
                  active={windowMinutes === value}
                  onClick={() => setWindowMinutes(value)}
                  title={`${value} minute window`}
                >
                  {value}m
                </FilterChip>
              ))}
            </FilterGroup>
          </FilterBar>
        }
      />
      <p className="-mt-2 text-xs text-[var(--text-secondary)]">
        Last updated: {formatUpdated(data?.timestamp)}
        {data && loading && (
          <span className="ml-2 inline-flex items-center gap-1">
            <RefreshCw size={11} className="animate-spin motion-reduce:animate-none" /> Refreshing
          </span>
        )}
      </p>

      {!data && loading ? (
        <MarketTideSkeleton />
      ) : !data && error ? (
        <ErrorMessage message={error} onRetry={refetch} />
      ) : (
        data && (
          <>
            {error && (
              <div role="status" className="text-xs text-[var(--color-bear)]">
                Refresh failed. Showing the latest successful snapshot.
              </div>
            )}

            {/* hero: score + tide chart */}
            <div className="grid gap-4 lg:grid-cols-3">
              <ScorePanel data={data} />
              <TideCard windowMinutes={windowMinutes} />
            </div>

            {/* flow×gamma map + the read */}
            <div className="grid gap-4 lg:grid-cols-2">
              <section className={card} style={cardStyle} aria-label="Flow versus gamma map">
                <div className="flex items-center justify-between gap-3">
                  <MetricTitle tip="Each index by its directional flow (x) and dealer gamma (y). Up = short gamma (moves amplify), down = long gamma (moves pinned); right = call-led, left = put-led.">
                    Flow × Gamma
                  </MetricTitle>
                  <span className="text-xs uppercase tracking-[.14em] text-[var(--text-muted)]">Where each index sits</span>
                </div>
                <div className="mt-4">
                  <FlowGammaMap components={components} />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">
                  Up = dealers <b className="text-[var(--text-secondary)]">short gamma</b>, moves get amplified · down ={" "}
                  <b className="text-[var(--text-secondary)]">long gamma</b>, moves pinned. Right = call-led flow, left = put-led.
                </p>
              </section>
              <ReadCard data={data} />
            </div>

            {/* raw metric cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <section className={card} style={cardStyle}>
                <MetricTitle tip="Directional aggregate options pressure; it does not replace the Market Tide label.">
                  <Activity size={15} /> Flow Direction
                </MetricTitle>
                <div className="zg-metric mt-4 text-3xl">{formatNumber(flow)}</div>
                <p className="mt-2 font-semibold">
                  {flow == null ? "Unavailable" : Math.abs(flow) < 0.005 ? "Balanced" : flow > 0 ? "Call-led / bullish" : "Put-led / bearish"}
                </p>
              </section>
              <section className={card} style={cardStyle}>
                <MetricTitle tip="Gamma changes how strongly directional flow may move the market; it is not itself bullish or bearish.">
                  <Gauge size={15} /> Gamma Regime
                </MetricTitle>
                <div className="mt-4 flex items-baseline gap-3">
                  <span className="zg-metric text-3xl">{formatNumber(gamma)}</span>
                  <span className="font-semibold">{gammaLabel}</span>
                </div>
                <p className="mt-3 text-sm text-[var(--text-secondary)]">{gammaCopy}</p>
              </section>
              <section className={`${card} ${participation < 60 ? "border-[var(--color-bear)]" : ""}`} style={cardStyle}>
                <MetricTitle tip="Share of configured symbols with fresh flow and gamma data.">
                  <Users size={15} /> Participation
                </MetricTitle>
                <div className="zg-metric mt-4 text-3xl">
                  {formatNumber(data.eligible_symbols, 0)}{" "}
                  <span className="text-lg" style={{ color: "var(--text-secondary)" }}>of {formatNumber(data.configured_symbols, 0)}</span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--border-default)]" role="progressbar" aria-label="Market Tide participation" aria-valuemin={0} aria-valuemax={100} aria-valuenow={participation}>
                  <div className="h-full bg-[var(--color-brand-primary)]" style={{ width: `${participation}%` }} />
                </div>
                <p className="mt-2 text-sm font-semibold">
                  {formatNumber(data.participation_pct, 1)}% {participation < 60 && "· Below 60% minimum"}
                </p>
              </section>
            </div>

            {/* by ticker */}
            <section className={card} style={cardStyle}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="zg-h3">By ticker</h2>
                <div className="flex gap-4 font-mono text-xs text-[var(--text-secondary)]">
                  <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-bull)" }} /> adds lift</span>
                  <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-bear)" }} /> adds drag</span>
                </div>
              </div>
              <div className="mt-4">
                <ByTickerStrip rows={components} />
              </div>
            </section>

            {/* breadth */}
            <section className={card} style={cardStyle}>
              <h2 className="zg-h3">Market Breadth</h2>
              <div
                className="mt-5 flex h-5 overflow-hidden rounded-full"
                role="img"
                aria-label={`Market breadth — bullish ${formatNumber(data.bullish_breadth_pct, 1)}%, neutral ${formatNumber(data.neutral_breadth_pct, 1)}%, bearish ${formatNumber(data.bearish_breadth_pct, 1)}%`}
              >
                <div className="bg-[var(--color-bull)]" style={{ width: `${breadth[0]}%` }} />
                <div className="bg-[var(--border-default)]" style={{ width: `${breadth[1]}%` }} />
                <div className="bg-[var(--color-bear)]" style={{ width: `${breadth[2]}%` }} />
              </div>
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                <span>▲ Bullish breadth <strong>{formatNumber(data.bullish_breadth_pct, 1)}%</strong></span>
                <span className="sm:text-center">● Neutral breadth <strong>{formatNumber(data.neutral_breadth_pct, 1)}%</strong></span>
                <span className="sm:text-right">▼ Bearish breadth <strong>{formatNumber(data.bearish_breadth_pct, 1)}%</strong></span>
              </div>
            </section>

            {Array.isArray(data.stale_symbols) && data.stale_symbols.length > 0 && (
              <details className={`${card} ${participation < 60 ? "border-[var(--color-bear)]" : ""}`} style={cardStyle}>
                <summary className="cursor-pointer font-semibold">Stale or unavailable symbols ({data.stale_symbols.length})</summary>
                <div className="mt-4 flex flex-wrap gap-2">
                  {data.stale_symbols.map((symbol, i) => (
                    <span key={`${symbol}-${i}`} className="rounded-full border px-3 py-1 text-xs font-mono" style={border}>
                      {symbol || "Unknown"}
                    </span>
                  ))}
                </div>
              </details>
            )}
          </>
        )
      )}
    </PageShell>
  );
}
