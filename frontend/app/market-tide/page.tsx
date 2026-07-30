"use client";

import { useState } from "react";
import { Activity, Gauge, RefreshCw, Users, Waves } from "lucide-react";
import PageShell from "@/components/layout/PageShell";
import ErrorMessage from "@/components/ErrorMessage";
import TooltipWrapper from "@/components/TooltipWrapper";
import { formatEtDate, formatEtTime } from "@/core/signalHelpers";
import { useApiData } from "@/hooks/useApiData";
import {
  breadthWidths, finite, formatLabel, formatNumber, formatSigned,
  markerPosition, safePercent, type MarketTideComponent, type MarketTideResponse,
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
const card = "rounded-2xl border p-5 sm:p-6";
const cardStyle = { background: "var(--bg-card)", borderColor: "var(--color-border)" };

function MetricTitle({ children, tip }: { children: React.ReactNode; tip: string }) {
  return <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-[var(--text-secondary)]">{children}<TooltipWrapper text={tip} /></div>;
}

function GaugePanel({ data }: { data: MarketTideResponse }) {
  const insufficient = data.score === null || data.label === "insufficient_data";
  const position = insufficient ? null : markerPosition(data.score);
  const score = finite(data.score);
  return <section className={`${card} overflow-hidden`} style={cardStyle} aria-labelledby="tide-gauge-title">
    <div className="flex items-center gap-2"><Waves aria-hidden="true" size={20} className="text-[var(--color-brand-primary)]"/><h2 id="tide-gauge-title" className="font-semibold">Market Tide</h2></div>
    <div className="py-8 text-center" {...(insufficient ? { role: "img", "aria-label": "Market Tide gauge: Insufficient Data. Score withheld until at least 60% of supported symbols have fresh gamma and flow data." } : {})}>
      <div className="text-sm font-semibold uppercase tracking-[.2em] text-[var(--text-secondary)]">{insufficient ? "Score withheld" : formatLabel(data.label)}</div>
      <div className="mt-2 text-5xl font-bold tabular-nums">{insufficient || score == null ? "Insufficient Data" : formatNumber(score, 1)}</div>
      {insufficient && <p className="mx-auto mt-4 max-w-2xl text-sm text-[var(--text-secondary)]">The Market Tide score is withheld until at least 60% of supported symbols have fresh gamma and flow data.</p>}
    </div>
    {!insufficient && score != null && position != null && <div role="meter" aria-label="Market Tide score, bearish to bullish" aria-valuemin={-100} aria-valuemax={100} aria-valuenow={score} aria-valuetext={`${formatNumber(score, 1)}, ${formatLabel(data.label)}`}>
      <div className="relative h-4 rounded-full bg-gradient-to-r from-[var(--color-bear)] via-[var(--color-border)] to-[var(--color-bull)]">
        <span className="absolute left-1/2 top-[-5px] h-6 w-px bg-[var(--text-primary)]" aria-hidden="true" />
        <span data-testid="gauge-marker" className="absolute top-1/2 h-7 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--bg-card)] bg-[var(--text-primary)] motion-reduce:transition-none" style={{ left: `${position}%` }} aria-hidden="true" />
      </div>
      <div className="mt-3 flex justify-between text-xs font-semibold"><span>Bearish · −100</span><span>Neutral · 0</span><span>Bullish · +100</span></div>
    </div>}
  </section>;
}

function ContributorTable({ title, rows, empty }: { title: string; rows: MarketTideComponent[]; empty: string }) {
  const tips: Record<string, string> = { Contribution: "Signed contribution before the final score's ×100 display scaling.", Flow: "Directional options-flow score for this symbol.", Gamma: "Dealer gamma score; negative amplifies and positive dampens.", Amplifier: "Multiplier applied to flow under the gamma regime.", Weight: "Symbol weight as a fraction of the supported market basket." };
  return <section className={card} style={cardStyle}><h3 className="text-lg font-semibold">{title}</h3>
    {rows.length === 0 ? <p className="mt-5 rounded-xl border border-dashed p-6 text-center text-sm text-[var(--text-secondary)]" style={{borderColor:"var(--color-border)"}}>{empty}</p> :
    <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wider text-[var(--text-secondary)]" style={{borderColor:"var(--color-border)"}}>
      <th className="p-3">Symbol</th>{Object.entries(tips).map(([label, tip]) => <th key={label} className="p-3 text-right"><span className="inline-flex items-center gap-1">{label}<TooltipWrapper text={tip}/></span></th>)}
    </tr></thead><tbody>{rows.map((row, i) => <tr key={`${row.symbol}-${i}`} className="border-b last:border-0" style={{borderColor:"var(--color-border)"}}><th scope="row" className="p-3 text-left font-mono font-bold">{row.symbol || "—"}</th><td className="p-3 text-right font-mono">{formatSigned(row.contribution)}</td><td className="p-3 text-right font-mono">{formatNumber(row.flow_score)}</td><td className="p-3 text-right font-mono">{formatNumber(row.gamma_score)}</td><td className="p-3 text-right font-mono">{formatNumber(row.amplifier, 3)}</td><td className="p-3 text-right font-mono">{finite(row.weight) == null ? "—" : `${formatNumber((finite(row.weight) ?? 0) * 100, 1)}%`}</td></tr>)}</tbody></table></div>}
  </section>;
}

function MarketTideSkeleton() { return <div data-testid="market-tide-skeleton" className="space-y-5 animate-pulse motion-reduce:animate-none" aria-label="Loading Market Tide"><div className="h-36 rounded-2xl bg-[var(--color-border)] opacity-40"/><div className="grid gap-4 md:grid-cols-3">{[1,2,3].map(x=><div key={x} className="h-40 rounded-2xl bg-[var(--color-border)] opacity-40"/>)}</div></div>; }

export default function MarketTidePage() {
  const [windowMinutes, setWindowMinutes] = useState<(typeof WINDOWS)[number]>(15);
  const { data, loading, error, refetch } = useApiData<MarketTideResponse>(`/api/market-tide?window=${windowMinutes}`, { refreshInterval: 30_000 });
  const flow = finite(data?.flow_direction); const gamma = finite(data?.gamma_regime); const participation = safePercent(data?.participation_pct);
  const breadth = breadthWidths([data?.bullish_breadth_pct, data?.neutral_breadth_pct, data?.bearish_breadth_pct]);
  const gammaLabel = formatLabel(data?.gamma_label);
  const gammaCopy = data?.gamma_label === "amplifying" ? "Negative gamma can strengthen moves in the direction of options pressure." : data?.gamma_label === "dampening" ? "Positive gamma can absorb or moderate directional options pressure." : "Dealer gamma is not materially amplifying or dampening options pressure.";
  return <PageShell width="wide" className="space-y-6">
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-brand-primary)]"><Waves size={16}/> Metrics · Beta</div><h1 className="text-3xl font-bold sm:text-4xl">Market Tide</h1><p className="mt-2 text-[var(--text-secondary)]">Market-wide options pressure adjusted for the dealer gamma regime.</p><p className="mt-2 text-xs text-[var(--text-secondary)]">Last updated: {formatUpdated(data?.timestamp)} {data && loading && <span className="ml-2 inline-flex items-center gap-1"><RefreshCw size={11} className="animate-spin motion-reduce:animate-none"/> Refreshing</span>}</p></div>
      <fieldset><legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Window</legend><div className="inline-flex rounded-xl border p-1" style={cardStyle}>{WINDOWS.map(value=><button key={value} type="button" aria-label={`${value} minute window`} aria-pressed={windowMinutes===value} onClick={()=>setWindowMinutes(value)} className="rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 aria-pressed:bg-[var(--color-brand-primary)] aria-pressed:text-white">{value}m</button>)}</div></fieldset>
    </header>
    {!data && loading ? <MarketTideSkeleton/> : !data && error ? <ErrorMessage message={error} onRetry={refetch}/> : data && <>
      {error && <div role="status" className="text-xs text-[var(--color-bear)]">Refresh failed. Showing the latest successful snapshot.</div>}
      <GaugePanel data={data}/>
      <div className="grid gap-4 md:grid-cols-3">
        <section className={card} style={cardStyle}><MetricTitle tip="Directional aggregate options pressure; it does not replace the Market Tide label."><Activity size={15}/> Flow Direction</MetricTitle><div className="mt-4 text-3xl font-bold tabular-nums">{formatNumber(flow)}</div><p className="mt-2 font-semibold">{flow == null ? "Unavailable" : Math.abs(flow) < .005 ? "Balanced" : flow > 0 ? "Call-led / bullish" : "Put-led / bearish"}</p></section>
        <section className={card} style={cardStyle}><MetricTitle tip="Gamma changes how strongly directional flow may move the market; it is not itself bullish or bearish."><Gauge size={15}/> Gamma Regime</MetricTitle><div className="mt-4 flex items-baseline gap-3"><span className="text-3xl font-bold tabular-nums">{formatNumber(gamma)}</span><span className="font-semibold">{gammaLabel}</span></div><p className="mt-3 text-sm text-[var(--text-secondary)]">{gammaCopy}</p></section>
        <section className={`${card} ${participation < 60 ? "border-[var(--color-bear)]" : ""}`} style={cardStyle}><MetricTitle tip="Share of configured symbols with fresh flow and gamma data."><Users size={15}/> Participation</MetricTitle><div className="mt-4 text-3xl font-bold">{formatNumber(data.eligible_symbols, 0)} <span className="text-lg text-[var(--text-secondary)]">of {formatNumber(data.configured_symbols, 0)}</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--color-border)]" role="progressbar" aria-label="Market Tide participation" aria-valuemin={0} aria-valuemax={100} aria-valuenow={participation}><div className="h-full bg-[var(--color-brand-primary)]" style={{width:`${participation}%`}}/></div><p className="mt-2 text-sm font-semibold">{formatNumber(data.participation_pct, 1)}% {participation < 60 && "· Below 60% minimum"}</p></section>
      </div>
      <section className={card} style={cardStyle}><h2 className="text-lg font-semibold">Market Breadth</h2><div className="mt-5 flex h-5 overflow-hidden rounded-full" role="img" aria-label={`Market breadth — bullish ${formatNumber(data.bullish_breadth_pct, 1)}%, neutral ${formatNumber(data.neutral_breadth_pct, 1)}%, bearish ${formatNumber(data.bearish_breadth_pct, 1)}%`}><div className="bg-[var(--color-bull)]" style={{width:`${breadth[0]}%`}}/><div className="bg-[var(--color-border)]" style={{width:`${breadth[1]}%`}}/><div className="bg-[var(--color-bear)]" style={{width:`${breadth[2]}%`}}/></div><div className="mt-4 grid gap-2 text-sm sm:grid-cols-3"><span>▲ Bullish breadth <strong>{formatNumber(data.bullish_breadth_pct,1)}%</strong></span><span className="sm:text-center">● Neutral breadth <strong>{formatNumber(data.neutral_breadth_pct,1)}%</strong></span><span className="sm:text-right">▼ Bearish breadth <strong>{formatNumber(data.bearish_breadth_pct,1)}%</strong></span></div></section>
      <div><h2 className="mb-4 text-xl font-semibold">What is moving the tide?</h2><div className="grid gap-5 xl:grid-cols-2"><ContributorTable title="Leaders" rows={Array.isArray(data.leaders)?data.leaders:[]} empty="No positive contributors in this window."/><ContributorTable title="Laggards" rows={Array.isArray(data.laggards)?data.laggards:[]} empty="No negative contributors in this window."/></div></div>
      {Array.isArray(data.stale_symbols) && data.stale_symbols.length > 0 && <details className={`${card} ${participation < 60 ? "border-[var(--color-bear)]" : ""}`} style={cardStyle}><summary className="cursor-pointer font-semibold">Stale or unavailable symbols ({data.stale_symbols.length})</summary><div className="mt-4 flex flex-wrap gap-2">{data.stale_symbols.map((symbol,i)=><span key={`${symbol}-${i}`} className="rounded-full border px-3 py-1 text-xs font-mono" style={{borderColor:"var(--color-border)"}}>{symbol || "Unknown"}</span>)}</div></details>}
    </>}
  </PageShell>;
}
