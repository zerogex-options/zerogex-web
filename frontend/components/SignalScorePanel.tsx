'use client';

import { useMemo, useState } from 'react';
import { Info, X } from 'lucide-react';
import { Radar, RadarChart, PolarAngleAxis, PolarGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { useSignalScore } from '@/hooks/useApiData';
import { getRegimeLabel } from '@/core/signalConstants';
import TooltipWrapper from '@/components/TooltipWrapper';
import MobileScrollableChart from '@/components/MobileScrollableChart';

type SignalComponentRow = {
  name: string;
  weight: number;
  score: number | null;
  contribution: number | null;
};

const COMPONENT_DISPLAY_ORDER: Record<string, number> = {
  'Dealer Regime': 1,
  'GEX Gradient': 2,
  'Tape Flow Bias': 3,
  'Dealer Delta Pressure': 4,
  'Vanna Charm Flow': 5,
  'Intraday Regime': 6,
  'Skew Delta': 7,
  'Smart Money': 8,
  'Vol Expansion': 9,
  'Opportunity Quality': 10,
  'Gamma Flip': 11,
  Exhaustion: 12,
  'Positioning Trap': 13,
  'Put/Call Ratio': 14,
};

const RADAR_COMPONENT_ORDER = [
  'Smart Money',
  'Dealer Regime',
  'GEX Gradient',
  'Tape Flow Bias',
  'Dealer Delta Pressure',
  'Vanna Charm Flow',
  'Intraday Regime',
  'Skew Delta',
] as const;

const COMPONENT_DETAILS: Record<string, { what: string; why: string; spectrum: { negative: string; neutral: string; positive: string } }> = {
  'Dealer Regime': {
    what: 'Measures whether dealer hedging tends to dampen moves (+gamma) or amplify moves (−gamma).',
    why: 'Dealer positioning heavily influences index intraday behavior and breakout follow-through probability.',
    spectrum: {
      negative: 'Extreme negative: dealers are short gamma and hedging can accelerate directional moves.',
      neutral: 'Net 0: mixed/transition regime, with less predictable damping or amplification.',
      positive: 'Extreme positive: dealers are long gamma and hedging often suppresses volatility and mean-reverts price.',
    },
  },
  'Smart Money': {
    what: 'Tracks premium-weighted institutional call versus put flow from large/unusual options trades.',
    why: 'Large informed flow can signal where sophisticated participants are expressing conviction.',
    spectrum: {
      negative: 'Extreme negative: put-heavy flow bias suggests defensive/downside positioning.',
      neutral: 'Net 0: call and put flow are balanced, giving less directional edge.',
      positive: 'Extreme positive: call-heavy flow bias suggests upside participation and risk-on tone.',
    },
  },
  'GEX Gradient': {
    what: 'Measures how rapidly gamma exposure changes as price moves across nearby strikes.',
    why: 'Steeper gradients can create sharper hedging reactions and faster intraday acceleration/deceleration.',
    spectrum: {
      negative: 'Extreme negative: gradient supports downside-amplifying dealer reactions.',
      neutral: 'Net 0: balanced slope with limited directional edge from gamma curvature.',
      positive: 'Extreme positive: gradient supports upside-stabilizing or supportive hedging dynamics.',
    },
  },
  'Tape Flow Bias': {
    what: 'Captures real-time directional pressure in executed options/underlying flow.',
    why: 'Short-term flow bias helps confirm whether price action is being supported or faded by participation.',
    spectrum: {
      negative: 'Extreme negative: sustained sell-side/put-biased tape pressure.',
      neutral: 'Net 0: balanced flow, low conviction from tape.',
      positive: 'Extreme positive: sustained buy-side/call-biased tape pressure.',
    },
  },
  'Dealer Delta Pressure': {
    what: 'Estimates dealer delta-hedging pressure from aggregate options positioning.',
    why: 'Delta hedging can mechanically add directional flow that reinforces or dampens market moves.',
    spectrum: {
      negative: 'Extreme negative: hedging pressure leans toward downside reinforcement.',
      neutral: 'Net 0: little net dealer delta pressure.',
      positive: 'Extreme positive: hedging pressure leans toward upside reinforcement.',
    },
  },
  'Vanna Charm Flow': {
    what: 'Represents expected flow from vanna/charm effects as spot and time evolve.',
    why: 'These second-order Greeks can drive persistent dealer rebalancing even without large price shocks.',
    spectrum: {
      negative: 'Extreme negative: vanna/charm effects skew toward sell pressure.',
      neutral: 'Net 0: vanna/charm influence is muted or balanced.',
      positive: 'Extreme positive: vanna/charm effects skew toward buy pressure.',
    },
  },
  'Intraday Regime': {
    what: 'Classifies the current session structure (trend, mean-revert, transition).',
    why: 'Regime awareness improves trade selection and prevents using the wrong playbook for the tape.',
    spectrum: {
      negative: 'Extreme negative: bearish/trending intraday regime signal.',
      neutral: 'Net 0: transitional or mixed regime.',
      positive: 'Extreme positive: bullish/supportive intraday regime signal.',
    },
  },
  'Skew Delta': {
    what: 'Tracks directional information from changes in options skew and its delta sensitivity.',
    why: 'Skew shifts often reveal demand for downside or upside protection before spot fully reacts.',
    spectrum: {
      negative: 'Extreme negative: skew move implies stronger downside risk pricing.',
      neutral: 'Net 0: skew/delta posture is balanced.',
      positive: 'Extreme positive: skew move implies stronger upside participation/risk appetite.',
    },
  },
  'Vol Expansion': {
    what: 'Estimates whether volatility conditions are primed to expand or stay contained.',
    why: 'Volatility regime changes can determine whether directional trades trend or stall quickly.',
    spectrum: {
      negative: 'Extreme negative: compression regime where breakouts are less likely to sustain.',
      neutral: 'Net 0: balanced regime with no strong volatility expansion signal.',
      positive: 'Extreme positive: expansion regime where momentum and range extension are more likely.',
    },
  },
  'Opportunity Quality': {
    what: 'Scores whether current options structures offer favorable risk/reward characteristics.',
    why: 'Even with directional bias, poor structure quality can reduce expected value of trades.',
    spectrum: {
      negative: 'Extreme negative: unattractive setups with weaker payoff asymmetry.',
      neutral: 'Net 0: average setup quality without strong edge.',
      positive: 'Extreme positive: high-quality structures with stronger potential risk/reward.',
    },
  },
  'Gamma Flip': {
    what: 'Measures spot positioning relative to the gamma flip level where dealer behavior can change.',
    why: 'Crossing or rejecting flip zones often changes market tone from pinning to trending (or vice versa).',
    spectrum: {
      negative: 'Extreme negative: price materially below flip, favoring downside-amplifying dynamics.',
      neutral: 'Net 0: near the flip, indicating transition and lower directional clarity.',
      positive: 'Extreme positive: price materially above flip, favoring upside-supportive conditions.',
    },
  },
  Exhaustion: {
    what: 'Detects momentum and positioning extremes where current move may be overextended.',
    why: 'Exhaustion flags help avoid chasing late-stage moves and improve reversal timing context.',
    spectrum: {
      negative: 'Extreme negative: bearish exhaustion context (risk of downside fade ending / snapback).',
      neutral: 'Net 0: no major exhaustion signal present.',
      positive: 'Extreme positive: bullish exhaustion context (risk of upside fade ending / bounce).',
    },
  },
  'Positioning Trap': {
    what: 'Identifies crowded positioning and potential squeeze or flush setups.',
    why: 'Crowded consensus can reverse violently when price fails to confirm expected direction.',
    spectrum: {
      negative: 'Extreme negative: crowding skewed bearish with greater trap risk to downside chasers.',
      neutral: 'Net 0: limited crowding/trap signal.',
      positive: 'Extreme positive: crowding skewed bullish with greater trap risk to upside chasers.',
    },
  },
  'Put/Call Ratio': {
    what: 'Uses options put/call balance as a sentiment and positioning proxy.',
    why: 'Extremes in put/call behavior can indicate one-sided sentiment and potential inflection risk.',
    spectrum: {
      negative: 'Extreme negative: put-heavy sentiment indicating strong risk-off positioning.',
      neutral: 'Net 0: balanced put/call posture.',
      positive: 'Extreme positive: call-heavy sentiment indicating stronger risk-on positioning.',
    },
  },
};

interface SignalScorePanelProps {
  symbol: string;
}

function normalizeComponents(raw: unknown): SignalComponentRow[] {
  const COMPONENT_LABELS: Record<string, string> = {
    gex_regime: 'Dealer Regime',
    dealer_regime: 'Dealer Regime',
    gex_gradient: 'GEX Gradient',
    tape_flow_bias: 'Tape Flow Bias',
    dealer_delta_pressure: 'Dealer Delta Pressure',
    vanna_charm_flow: 'Vanna Charm Flow',
    intraday_regime: 'Intraday Regime',
    skew_delta: 'Skew Delta',
    smart_money: 'Smart Money',
    vol_expansion: 'Vol Expansion',
    opportunity_quality: 'Opportunity Quality',
    gamma_flip: 'Gamma Flip',
    exhaustion: 'Exhaustion',
    positioning_trap: 'Positioning Trap',
    put_call_ratio: 'Put/Call Ratio',
  };

  const fallbackComponents: SignalComponentRow[] = [
    { name: 'Dealer Regime', weight: 0.18, score: null, contribution: null },
    { name: 'Smart Money', weight: 0.16, score: null, contribution: null },
    { name: 'Vol Expansion', weight: 0.16, score: null, contribution: null },
    { name: 'Opportunity Quality', weight: 0.16, score: null, contribution: null },
    { name: 'Gamma Flip', weight: 0.12, score: null, contribution: null },
    { name: 'Exhaustion', weight: 0.12, score: null, contribution: null },
    { name: 'Positioning Trap', weight: 0.10, score: null, contribution: null },
    { name: 'Put/Call Ratio', weight: 0.10, score: null, contribution: null },
  ];

  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((c) => ({
      name: typeof c?.name === 'string' ? c.name : 'Component',
      weight: typeof c?.weight === 'number' ? c.weight : 0,
      score: typeof c?.score === 'number' ? c.score : null,
      contribution: typeof c?.contribution === 'number' ? c.contribution : null,
    })).sort((a, b) => b.weight - a.weight || (COMPONENT_DISPLAY_ORDER[a.name] ?? 999) - (COMPONENT_DISPLAY_ORDER[b.name] ?? 999));
  }

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const dict = raw as Record<string, { score?: number; weight?: number; contribution?: number }>;
    return Object.entries(dict).map(([key, value]) => ({
      name: COMPONENT_LABELS[key] ?? key,
      weight: value.weight ?? 0,
      score: typeof value.score === 'number' ? value.score : null,
      contribution:
        typeof value.contribution === 'number'
          ? value.contribution
          : (typeof value.score === 'number' && typeof value.weight === 'number' ? value.score * value.weight : null),
    })).sort((a, b) => b.weight - a.weight || (COMPONENT_DISPLAY_ORDER[a.name] ?? 999) - (COMPONENT_DISPLAY_ORDER[b.name] ?? 999));
  }

  return fallbackComponents.sort((a, b) => b.weight - a.weight || (COMPONENT_DISPLAY_ORDER[a.name] ?? 999) - (COMPONENT_DISPLAY_ORDER[b.name] ?? 999));
}

export default function SignalScorePanel({ symbol }: SignalScorePanelProps) {
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const { data: scoreData } = useSignalScore(symbol, 10000);
  const resolvedScoreData = (() => {
    if (!scoreData || typeof scoreData !== 'object') return null;
    const candidate = scoreData as Record<string, unknown>;
    if (candidate.components || candidate.composite_score != null || candidate.score != null) {
      return candidate;
    }
    const nested = candidate.data;
    if (nested && typeof nested === 'object') {
      const nestedCandidate = nested as Record<string, unknown>;
      if (nestedCandidate.components || nestedCandidate.composite_score != null || nestedCandidate.score != null) {
        return nestedCandidate;
      }
    }
    return candidate;
  })();

  const components = normalizeComponents(resolvedScoreData?.components);
  const compositeScoreRaw = resolvedScoreData?.composite_score ?? resolvedScoreData?.score;
  const compositeScore = typeof compositeScoreRaw === 'number' ? compositeScoreRaw : null;
  const radarData = RADAR_COMPONENT_ORDER
    .map((name) => components.find((component) => component.name === name))
    .filter((component): component is SignalComponentRow => Boolean(component) && component.weight > 0)
    .map((component) => ({
      axis: component.name,
      weightScore: Math.max(0, Math.min(100, component.weight * 100)),
      description: `${Math.round(component.weight * 100)}% model weighting`,
    }));
  const selectedComponentDetails = useMemo(
    () => (selectedComponent ? COMPONENT_DETAILS[selectedComponent] : null),
    [selectedComponent],
  );

  return (
    <>
      <div className="zg-feature-shell p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)] mb-2 flex items-center gap-2">
              Current Market Feel
              <TooltipWrapper text="Weighted composite of model components. Positive = bullish, negative = bearish, magnitude = conviction." placement="bottom">
                <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
              </TooltipWrapper>
            </div>
            {(() => {
              const hasScore = compositeScore != null;
              const directionLabel = hasScore ? getRegimeLabel(compositeScore) : 'Awaiting signal data';

              return (
                <>
                  <div
                    className="text-6xl font-black leading-none"
                    style={{
                      color: hasScore
                        ? (compositeScore > 0 ? 'var(--color-bull)' : compositeScore < 0 ? 'var(--color-bear)' : 'var(--color-warning)')
                        : 'var(--color-text-primary)',
                    }}
                  >
                    {hasScore ? compositeScore.toFixed(2) : '--'}
                  </div>
                  <div className="mt-2 text-lg font-semibold">{directionLabel}</div>
                </>
              );
            })()}
            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
              Aggregate weighted conviction of eight independent market signals (−100 to +100). Positive = net bullish evidence, negative = net bearish. The normalized score (absolute value, 0–100) represents pure conviction strength regardless of direction.
            </p>
          </div>

          <div className="lg:col-span-3 rounded-xl border border-[var(--color-border)] p-5 bg-[var(--color-surface-subtle)]">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold">Score Spectrum</div>
              <div className="text-xs text-[var(--color-text-secondary)]">Range: −100 to +100</div>
            </div>

            <div className="relative mt-4">
              <div
                className="h-4 rounded-full"
                style={{
                  background:
                    'linear-gradient(90deg, var(--color-bear) 0%, #d98572 21%, var(--color-warning) 50%, #75cfa1 79%, var(--color-bull) 100%)',
                }}
              />
              <div className="absolute top-0 h-4 w-px bg-[var(--color-text-primary)] opacity-40" style={{ left: '21%' }} />
              <div className="absolute top-0 h-4 w-px bg-[var(--color-text-primary)] opacity-40" style={{ left: '79%' }} />
              <div className="absolute top-0 h-4 w-px bg-[var(--color-text-primary)] opacity-25" style={{ left: '35%' }} />
              <div className="absolute top-0 h-4 w-px bg-[var(--color-text-primary)] opacity-25" style={{ left: '65%' }} />
              <div
                className="absolute -top-2 h-8 w-0.5 bg-[var(--color-text-primary)]"
                style={{
                  left:
                    compositeScore != null
                      ? `${Math.max(0, Math.min(100, (compositeScore + 100) / 2))}%`
                      : '50%',
                  transform: 'translateX(-50%)',
                }}
              />
            </div>

            <div className="mt-3 grid grid-cols-5 text-[11px] text-[var(--color-text-secondary)]">
              <span className="text-left">−100</span>
              <span className="text-center">−58</span>
              <span className="text-center">0</span>
              <span className="text-center">+58</span>
              <span className="text-right">+100</span>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
              <div className="rounded-lg border border-[var(--color-border)] p-2.5 bg-[var(--color-surface)]">
                <div className="font-semibold text-[var(--color-bear)]">Strong Bear</div>
                <div className="text-[var(--color-text-secondary)] mt-1">−100 to −58: tradeable bearish signal.</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] p-2.5 bg-[var(--color-surface)]">
                <div className="font-semibold text-[var(--color-bear)] opacity-70">Weak Bear</div>
                <div className="text-[var(--color-text-secondary)] mt-1">−58 to −30: below trigger, no trade.</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] p-2.5 bg-[var(--color-surface)]">
                <div className="font-semibold text-[var(--color-warning)]">Neutral</div>
                <div className="text-[var(--color-text-secondary)] mt-1">−30 to +30: near-neutral, no edge.</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] p-2.5 bg-[var(--color-surface)]">
                <div className="font-semibold text-[var(--color-bull)] opacity-70">Weak Bull</div>
                <div className="text-[var(--color-text-secondary)] mt-1">+30 to +58: below trigger, no trade.</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] p-2.5 bg-[var(--color-surface)]">
                <div className="font-semibold text-[var(--color-bull)]">Strong Bull</div>
                <div className="text-[var(--color-text-secondary)] mt-1">+58 to +100: tradeable bullish signal.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="zg-feature-shell mt-8 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)] h-full min-h-[360px]">
            <div className="text-sm font-semibold mb-2">Component Weights</div>
            <div className="text-xs text-[var(--color-text-secondary)] mb-2">Radar view of 8 primary model components</div>
            <div className="h-[420px]">
              <MobileScrollableChart minWidthClass="min-w-[900px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="68%">
                  <PolarGrid stroke="var(--color-border)" />
                  <PolarAngleAxis dataKey="axis" tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} />
                  <Radar dataKey="weightScore" stroke="var(--color-warning)" fill="var(--color-warning)" fillOpacity={0.45} />
                  <Tooltip
                    contentStyle={{ background: 'var(--color-chart-tooltip-bg)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-chart-tooltip-text)' }}
                    formatter={(value, _n, item) => [`${Number(value).toFixed(0)}%`, String((item.payload as { description?: string }).description ?? '')]}
                  />
                </RadarChart>
              </ResponsiveContainer>
              </MobileScrollableChart>
            </div>
          </div>

          <div className="lg:col-span-3 rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)] h-full">
            <div className="text-sm font-semibold mb-3">Component Score Breakdown</div>
            <div className="grid grid-cols-[minmax(140px,1.4fr)_0.8fr_0.8fr_0.8fr_minmax(80px,1fr)] gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] pb-2 border-b border-[var(--color-border)]">
              <span>Component</span>
              <span className="text-right">Weight</span>
              <span className="text-right">Score</span>
              <span className="text-right">Contribution</span>
              <span className="text-center">Spectrum</span>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {components.map((component) => {
                const spectrumPct = component.score != null ? Math.max(0, Math.min(100, (component.score + 100) / 2)) : null;
                return (
                  <div key={component.name} className="grid grid-cols-[minmax(140px,1.4fr)_0.8fr_0.8fr_0.8fr_minmax(80px,1fr)] gap-2 text-sm py-2 items-center">
                    <button
                      type="button"
                      onClick={() => setSelectedComponent(component.name)}
                      className="font-medium text-left hover:underline flex items-center gap-1.5"
                    >
                      {component.name}
                      <Info size={12} className="text-[var(--color-text-secondary)]" />
                    </button>
                    <span className="text-right text-[var(--color-text-secondary)]">{(component.weight * 100).toFixed(0)}%</span>
                    <span className="text-right">{component.score != null ? `${component.score >= 0 ? '+' : ''}${component.score.toFixed(2)}` : '—'}</span>
                    <span className="text-right" style={{ color: component.contribution != null ? (component.contribution >= 0 ? 'var(--color-bull)' : 'var(--color-bear)') : 'var(--color-text-secondary)' }}>
                      {component.contribution != null ? `${component.contribution >= 0 ? '+' : ''}${component.contribution.toFixed(3)}` : '—'}
                    </span>
                    <span className="flex items-center justify-center">
                      {spectrumPct != null ? (
                        <div className="relative w-full h-2 rounded-full" style={{ background: 'linear-gradient(90deg, var(--color-bear) 0%, var(--color-warning) 50%, var(--color-bull) 100%)' }}>
                          <div className="absolute -top-0.5 h-3 w-0.5 bg-[var(--color-text-primary)] rounded-sm" style={{ left: `${spectrumPct}%`, transform: 'translateX(-50%)' }} />
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--color-text-secondary)]">—</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {selectedComponent && selectedComponentDetails && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedComponent(null)} role="presentation">
          <div
            className="w-full max-w-xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="component-breakdown-title"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 id="component-breakdown-title" className="text-lg font-semibold">{selectedComponent}</h3>
              <button type="button" onClick={() => setSelectedComponent(null)} className="rounded p-1 hover:bg-[var(--color-surface-subtle)]" aria-label="Close component details">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
              <p><span className="font-semibold text-[var(--color-text-primary)]">What it is:</span> {selectedComponentDetails.what}</p>
              <p><span className="font-semibold text-[var(--color-text-primary)]">Why it matters:</span> {selectedComponentDetails.why}</p>
              <div>
                <div className="font-semibold text-[var(--color-text-primary)] mb-1">Spectrum interpretation</div>
                <ul className="space-y-1 list-disc pl-4">
                  <li><span className="font-medium text-[var(--color-bear)]">Extreme Negative:</span> {selectedComponentDetails.spectrum.negative}</li>
                  <li><span className="font-medium text-[var(--color-warning)]">Net 0:</span> {selectedComponentDetails.spectrum.neutral}</li>
                  <li><span className="font-medium text-[var(--color-bull)]">Extreme Positive:</span> {selectedComponentDetails.spectrum.positive}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
