'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Info, Target, Users, X } from 'lucide-react';
import { Radar, RadarChart, PolarAngleAxis, PolarGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { useSignalScore } from '@/hooks/useApiData';
import { getRegimeLabel } from '@/core/signalConstants';
import TooltipWrapper from '@/components/TooltipWrapper';
import MobileScrollableChart from '@/components/MobileScrollableChart';

type SignalComponentRow = {
  key?: string;
  name: string;
  weight: number;
  score: number | null;
  contribution: number | null;
};

type AggregationData = {
  mode?: string;
  active_count?: number;
  active_weight?: number;
  raw_composite?: number;
  renormalized?: number;
  agreement?: number;
  agreement_multiplier?: number;
  max_abs_component?: number;
  extremity_multiplier?: number;
};

type AnalyticsData = {
  sample_size?: number;
  hit_rate?: number;
  expected_move_bp?: number;
  confidence?: number;
  action?: 'enter' | 'watch' | 'wait' | string;
  calibration_scope?: string;
};

function normalizeComponentScore(score: number | null | undefined): number {
  if (score == null || !Number.isFinite(score)) return 0;
  return Math.abs(score) > 1.5 ? score / 100 : score;
}

const COMPONENT_DISPLAY_ORDER: Record<string, number> = {
  'GEX Regime': 1,
  'Gamma Flip': 2,
  'Dealer Regime': 3,
  'GEX Gradient': 4,
  'Dealer Delta Pressure': 5,
  'Vanna Charm Flow': 6,
  'Smart Money': 7,
  'Tape Flow Bias': 8,
  'Put/Call Ratio': 9,
  'Skew Delta': 10,
  'Vol Expansion': 11,
  Exhaustion: 12,
  'Positioning Trap': 13,
  'Intraday Regime': 14,
  'Opportunity Quality': 15,
};

const COMPONENT_DETAILS: Record<string, { bucket: string; weight: number; what: string; math: string; why: string; abstains: string; spectrum: { negative: string; neutral: string; positive: string } }> = {
  'GEX Regime': {
    bucket: 'Dealer Structure',
    weight: 0.07,
    what: 'Magnitude/sign read of aggregate dealer gamma across the book.',
    math: 'score = -tanh(net_gex / 2.5e8)',
    why: 'Establishes the base volatility-amplification regime dealers are likely to enforce.',
    abstains: 'Effectively always active in production.',
    spectrum: {
      negative: 'Positive net GEX / long-gamma suppression regime.',
      neutral: 'Mixed or low-magnitude aggregate gamma regime.',
      positive: 'Negative net GEX / short-gamma amplification regime.',
    },
  },
  'Dealer Regime': {
    bucket: 'Dealer Structure',
    weight: 0.08,
    what: 'Measures whether dealer hedging tends to dampen moves (+gamma) or amplify moves (−gamma).',
    math: 'Composite 5-factor positional regime score normalized to [-1, +1].',
    why: 'Dealer positioning heavily influences index intraday behavior and breakout follow-through probability.',
    abstains: 'Never fully abstains; weak/unknown sub-inputs resolve to 0.',
    spectrum: {
      negative: 'Extreme negative: dealers are short gamma and hedging can accelerate directional moves.',
      neutral: 'Net 0: mixed/transition regime, with less predictable damping or amplification.',
      positive: 'Extreme positive: dealers are long gamma and hedging often suppresses volatility and mean-reverts price.',
    },
  },
  'Gamma Flip': {
    bucket: 'Dealer Structure',
    weight: 0.05,
    what: 'Distance of spot from the gamma flip strike where net dealer gamma changes sign.',
    math: 'score = tanh(distance_pct / 0.005)',
    why: 'Captures regime transition pressure around the flip boundary.',
    abstains: 'Abstains when gamma flip is unavailable.',
    spectrum: {
      negative: 'Below flip / mean-revert-favoring continuation regime.',
      neutral: 'Near flip / transitional structure.',
      positive: 'Above flip / momentum-amplifying continuation regime.',
    },
  },
  'Smart Money': {
    bucket: 'Flow / Positioning',
    weight: 0.09,
    what: 'Tracks premium-weighted institutional call versus put flow from large/unusual options trades.',
    math: 'Premium imbalance over recent smart-money window with confidence and divergence adjustment.',
    why: 'Large informed flow can signal where sophisticated participants are expressing conviction.',
    abstains: 'Abstains when recent smart-money premium is below activity threshold.',
    spectrum: {
      negative: 'Extreme negative: put-heavy flow bias suggests defensive/downside positioning.',
      neutral: 'Net 0: call and put flow are balanced, giving less directional edge.',
      positive: 'Extreme positive: call-heavy flow bias suggests upside participation and risk-on tone.',
    },
  },
  'GEX Gradient': {
    bucket: 'Dealer Structure',
    weight: 0.08,
    what: 'Measures how rapidly gamma exposure changes as price moves across nearby strikes.',
    math: 'Asymmetry between above-spot vs below-spot strike gamma buckets, adjusted for dealer sign.',
    why: 'Steeper gradients can create sharper hedging reactions and faster intraday acceleration/deceleration.',
    abstains: 'Abstains when strike-level gamma buckets are unavailable or insufficient.',
    spectrum: {
      negative: 'Extreme negative: gradient supports downside-amplifying dealer reactions.',
      neutral: 'Net 0: balanced slope with limited directional edge from gamma curvature.',
      positive: 'Extreme positive: gradient supports upside-stabilizing or supportive hedging dynamics.',
    },
  },
  'Tape Flow Bias': {
    bucket: 'Flow / Positioning',
    weight: 0.08,
    what: 'Captures real-time directional pressure in executed options/underlying flow.',
    math: 'Directional net premium over total absolute premium with saturation scaling.',
    why: 'Short-term flow bias helps confirm whether price action is being supported or faded by participation.',
    abstains: 'Abstains on thin/empty flow_by_type windows.',
    spectrum: {
      negative: 'Extreme negative: sustained sell-side/put-biased tape pressure.',
      neutral: 'Net 0: balanced flow, low conviction from tape.',
      positive: 'Extreme positive: sustained buy-side/call-biased tape pressure.',
    },
  },
  'Dealer Delta Pressure': {
    bucket: 'Dealer Structure',
    weight: 0.08,
    what: 'Estimates dealer delta-hedging pressure from aggregate options positioning.',
    math: 'score = -tanh(dealer_net_delta / 3.0e8)',
    why: 'Delta hedging can mechanically add directional flow that reinforces or dampens market moves.',
    abstains: 'Abstains if no dealer delta source and no usable strike-level proxies.',
    spectrum: {
      negative: 'Extreme negative: hedging pressure leans toward downside reinforcement.',
      neutral: 'Net 0: little net dealer delta pressure.',
      positive: 'Extreme positive: hedging pressure leans toward upside reinforcement.',
    },
  },
  'Vanna Charm Flow': {
    bucket: 'Dealer Structure',
    weight: 0.07,
    what: 'Represents expected flow from vanna/charm effects as spot and time evolve.',
    math: 'Combined(vanna + charm*time-of-day weighting) normalized to saturation.',
    why: 'These second-order Greeks can drive persistent dealer rebalancing even without large price shocks.',
    abstains: 'Abstains when vanna/charm exposure columns are missing.',
    spectrum: {
      negative: 'Extreme negative: vanna/charm effects skew toward sell pressure.',
      neutral: 'Net 0: vanna/charm influence is muted or balanced.',
      positive: 'Extreme positive: vanna/charm effects skew toward buy pressure.',
    },
  },
  'Intraday Regime': {
    bucket: 'Price Behavior',
    weight: 0.05,
    what: 'Classifies the current session structure (trend, mean-revert, transition).',
    math: 'Phase-aware momentum/mean-reversion/pinning logic across session windows.',
    why: 'Regime awareness improves trade selection and prevents using the wrong playbook for the tape.',
    abstains: 'Pre-open and post-close return neutral/abstain.',
    spectrum: {
      negative: 'Extreme negative: bearish/trending intraday regime signal.',
      neutral: 'Net 0: transitional or mixed regime.',
      positive: 'Extreme positive: bullish/supportive intraday regime signal.',
    },
  },
  'Skew Delta': {
    bucket: 'Flow / Positioning',
    weight: 0.04,
    what: 'Tracks directional information from changes in options skew and its delta sensitivity.',
    math: 'OTM put IV - OTM call IV vs baseline; deviation saturates and sign is inverted for bearish skew.',
    why: 'Skew shifts often reveal demand for downside or upside protection before spot fully reacts.',
    abstains: 'Abstains when either OTM put/call IV bucket is missing.',
    spectrum: {
      negative: 'Extreme negative: skew move implies stronger downside risk pricing.',
      neutral: 'Net 0: skew/delta posture is balanced.',
      positive: 'Extreme positive: skew move implies stronger upside participation/risk appetite.',
    },
  },
  'Vol Expansion': {
    bucket: 'Price Behavior',
    weight: 0.08,
    what: 'Estimates whether volatility conditions are primed to expand or stay contained.',
    math: 'Readiness (from net GEX) × momentum direction.',
    why: 'Volatility regime changes can determine whether directional trades trend or stall quickly.',
    abstains: 'Abstains with insufficient recent close history.',
    spectrum: {
      negative: 'Extreme negative: compression regime where breakouts are less likely to sustain.',
      neutral: 'Net 0: balanced regime with no strong volatility expansion signal.',
      positive: 'Extreme positive: expansion regime where momentum and range extension are more likely.',
    },
  },
  'Opportunity Quality': {
    bucket: 'Meta / Opportunity',
    weight: 0.07,
    what: 'Scores whether current options structures offer favorable risk/reward characteristics.',
    math: 'Optimizer-derived blend of POP, EV, liquidity, and sharpe-like quality metrics.',
    why: 'Even with directional bias, poor structure quality can reduce expected value of trades.',
    abstains: 'Abstains on neutral direction, failed chain query, or missing candidate path.',
    spectrum: {
      negative: 'Extreme negative: unattractive setups with weaker payoff asymmetry.',
      neutral: 'Net 0: average setup quality without strong edge.',
      positive: 'Extreme positive: high-quality structures with stronger potential risk/reward.',
    },
  },
  Exhaustion: {
    bucket: 'Price Behavior',
    weight: 0.05,
    what: 'Detects momentum and positioning extremes where current move may be overextended.',
    math: 'Weighted blend of drift, RSI extremes, and extension, then signed opposite momentum direction.',
    why: 'Exhaustion flags help avoid chasing late-stage moves and improve reversal timing context.',
    abstains: 'Abstains with insufficient price-history bars.',
    spectrum: {
      negative: 'Extreme negative: bearish exhaustion context (risk of downside fade ending / snapback).',
      neutral: 'Net 0: no major exhaustion signal present.',
      positive: 'Extreme positive: bullish exhaustion context (risk of upside fade ending / bounce).',
    },
  },
  'Positioning Trap': {
    bucket: 'Price Behavior',
    weight: 0.06,
    what: 'Identifies crowded positioning and potential squeeze or flush setups.',
    math: 'Net of squeeze-vs-flush crowding composites.',
    why: 'Crowded consensus can reverse violently when price fails to confirm expected direction.',
    abstains: 'Generally always emits (available inputs default missing legs to 0).',
    spectrum: {
      negative: 'Extreme negative: crowding skewed bearish with greater trap risk to downside chasers.',
      neutral: 'Net 0: limited crowding/trap signal.',
      positive: 'Extreme positive: crowding skewed bullish with greater trap risk to upside chasers.',
    },
  },
  'Put/Call Ratio': {
    bucket: 'Flow / Positioning',
    weight: 0.05,
    what: 'Uses options put/call balance as a sentiment and positioning proxy.',
    math: 'Threshold/interpolated PCR mapping between bullish and bearish extremes.',
    why: 'Extremes in put/call behavior can indicate one-sided sentiment and potential inflection risk.',
    abstains: 'Rarely abstains in practice; usually always populated.',
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
    gex_regime: 'GEX Regime',
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
    { name: 'GEX Regime', weight: 0.07, score: null, contribution: null },
    { name: 'Gamma Flip', weight: 0.05, score: null, contribution: null },
    { name: 'Dealer Regime', weight: 0.08, score: null, contribution: null },
    { name: 'GEX Gradient', weight: 0.08, score: null, contribution: null },
    { name: 'Dealer Delta Pressure', weight: 0.08, score: null, contribution: null },
    { name: 'Vanna Charm Flow', weight: 0.07, score: null, contribution: null },
    { name: 'Smart Money', weight: 0.09, score: null, contribution: null },
    { name: 'Tape Flow Bias', weight: 0.08, score: null, contribution: null },
    { name: 'Put/Call Ratio', weight: 0.05, score: null, contribution: null },
    { name: 'Skew Delta', weight: 0.04, score: null, contribution: null },
    { name: 'Vol Expansion', weight: 0.08, score: null, contribution: null },
    { name: 'Exhaustion', weight: 0.05, score: null, contribution: null },
    { name: 'Positioning Trap', weight: 0.06, score: null, contribution: null },
    { name: 'Intraday Regime', weight: 0.05, score: null, contribution: null },
    { name: 'Opportunity Quality', weight: 0.07, score: null, contribution: null },
  ];

  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((c) => ({
      name: typeof c?.name === 'string' ? c.name : 'Component',
      key: typeof c?.key === 'string' ? c.key : undefined,
      weight: typeof c?.weight === 'number' ? c.weight : 0,
      score: typeof c?.score === 'number' ? c.score : null,
      contribution: typeof c?.contribution === 'number' ? c.contribution : null,
    })).sort((a, b) => b.weight - a.weight || (COMPONENT_DISPLAY_ORDER[a.name] ?? 999) - (COMPONENT_DISPLAY_ORDER[b.name] ?? 999));
  }

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const dict = raw as Record<string, { score?: number; weight?: number; contribution?: number }>;
    return Object.entries(dict).map(([key, value]) => ({
      key,
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
  const regime = typeof resolvedScoreData?.regime === 'string' ? resolvedScoreData.regime : 'neutral_gamma';
  const analytics = (resolvedScoreData?.analytics && typeof resolvedScoreData.analytics === 'object'
    ? resolvedScoreData.analytics
    : null) as AnalyticsData | null;
  const aggregation = (resolvedScoreData?.aggregation && typeof resolvedScoreData.aggregation === 'object'
    ? resolvedScoreData.aggregation
    : null) as AggregationData | null;
  const compositeScoreRaw = resolvedScoreData?.composite_score ?? resolvedScoreData?.score;
  const compositeScore = typeof compositeScoreRaw === 'number' ? compositeScoreRaw : null;
  const scalpThreshold = 0.36;
  const fullThreshold = 0.52;
  const totalComponents = components.length;
  const activeFromRows = components.filter((component) => Math.abs(normalizeComponentScore(component.score)) >= 0.02).length;
  const activeCount = aggregation?.active_count ?? activeFromRows;
  const dormantCount = Math.max(0, totalComponents - activeCount);
  const activeWeight = aggregation?.active_weight ?? components.reduce((sum, component) => sum + (Math.abs(normalizeComponentScore(component.score)) >= 0.02 ? component.weight : 0), 0);
  const rawComposite = aggregation?.raw_composite ?? null;
  const renormalized = aggregation?.renormalized ?? null;
  const agreement = aggregation?.agreement ?? null;
  const agreementMultiplier = aggregation?.agreement_multiplier ?? null;
  const maxAbsComponent = aggregation?.max_abs_component ?? null;
  const extremityMultiplier = aggregation?.extremity_multiplier ?? null;
  const topComponent = useMemo(
    () => [...components].sort((a, b) => Math.abs(b.score ?? 0) - Math.abs(a.score ?? 0))[0] ?? null,
    [components],
  );
  const displayedFinalComposite = compositeScore != null ? compositeScore / 100 : null;
  const finalComposite = displayedFinalComposite ?? (renormalized != null && agreementMultiplier != null && extremityMultiplier != null
    ? renormalized * agreementMultiplier * extremityMultiplier
    : null);
  const nextThreshold = finalComposite == null
    ? null
    : finalComposite < scalpThreshold
      ? scalpThreshold
      : finalComposite < fullThreshold
        ? fullThreshold
        : null;
  const distanceToThreshold = nextThreshold != null && finalComposite != null ? nextThreshold - finalComposite : null;
  const thresholdTone = finalComposite == null
    ? 'neutral'
    : finalComposite >= fullThreshold
      ? 'green'
      : finalComposite >= scalpThreshold
        ? 'amber'
        : 'red';
  const radarData = [...components]
    .sort((a, b) => (COMPONENT_DISPLAY_ORDER[a.name] ?? 999) - (COMPONENT_DISPLAY_ORDER[b.name] ?? 999))
    .filter((component) => component.weight > 0)
    .map((component) => ({
      axis: component.name,
      weightScore: Math.max(0, Math.min(100, component.weight * 100)),
      description: `${Math.round(component.weight * 100)}% model weighting`,
    }));
  const sortedComponents = useMemo(() => {
    const sortedByContribution = [...components].sort((a, b) => {
      const contributionA = a.contribution ?? 0;
      const contributionB = b.contribution ?? 0;
      if ((compositeScore ?? 0) < 0) {
        if (contributionA !== contributionB) return contributionA - contributionB;
      } else {
        if (contributionA !== contributionB) return contributionB - contributionA;
      }
      return (COMPONENT_DISPLAY_ORDER[a.name] ?? 999) - (COMPONENT_DISPLAY_ORDER[b.name] ?? 999);
    });
    const active = sortedByContribution.filter((component) => Math.abs(normalizeComponentScore(component.score)) >= 0.02);
    const dormant = sortedByContribution.filter((component) => Math.abs(normalizeComponentScore(component.score)) < 0.02);
    const sorted = [...active, ...dormant];
    const topSorted = sorted[0];
    return sorted.map((component) => ({
      ...component,
      isDormant: Math.abs(normalizeComponentScore(component.score)) < 0.02,
      isTopByContribution:
        topSorted != null
        && component.name === topSorted.name
        && (component.contribution ?? 0) === (topSorted.contribution ?? 0),
    }));
  }, [components, compositeScore]);
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
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-xl font-semibold">Trader Decision Snapshot</h3>
          <span className="text-xs px-2 py-1 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)]">
            Aggregation mode: {aggregation?.mode ?? 'conviction'}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-3 bg-[var(--color-surface-subtle)]">
            <div className="text-xs text-[var(--color-text-secondary)] mb-1">Regime</div>
            <div className="font-semibold">{regime === 'short_gamma' ? 'Short Gamma (amplified moves)' : regime === 'long_gamma' ? 'Long Gamma (dampened moves)' : 'Neutral Gamma'}</div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-3 bg-[var(--color-surface-subtle)]">
            <div className="text-xs text-[var(--color-text-secondary)] mb-1">Action</div>
            <div className={`font-semibold uppercase ${analytics?.action === 'enter' ? 'text-[var(--color-bull)]' : analytics?.action === 'watch' ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-secondary)]'}`}>{analytics?.action ?? 'wait'}</div>
            <div className="text-[11px] text-[var(--color-text-secondary)] mt-1">Scope: {analytics?.calibration_scope ?? 'direction_only'}</div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-3 bg-[var(--color-surface-subtle)]">
            <div className="text-xs text-[var(--color-text-secondary)] mb-1">Edge Calibration</div>
            <div className="font-semibold">{analytics?.hit_rate != null ? `${(analytics.hit_rate * 100).toFixed(1)}% hit rate` : '—'}</div>
            <div className="text-[11px] text-[var(--color-text-secondary)] mt-1">{analytics?.sample_size != null ? `n=${analytics.sample_size}` : 'No sample info'} · {analytics?.expected_move_bp != null ? `${analytics.expected_move_bp.toFixed(2)} bp` : '-- bp'}</div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-3 bg-[var(--color-surface-subtle)]">
            <div className="text-xs text-[var(--color-text-secondary)] mb-1">Confidence</div>
            <div className="font-semibold">{analytics?.confidence != null ? `${(analytics.confidence * 100).toFixed(1)}%` : '—'}</div>
            <div className="text-[11px] text-[var(--color-text-secondary)] mt-1">Backtest-calibrated quality score.</div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)] mb-5">
          <div className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">How the composite was built this cycle</div>
          <div className="text-[11px] text-[var(--color-text-secondary)] mb-3">Read this left → right: raw signal, reweighted by active components, then scaled by agreement and extremity.</div>
          <div className="grid grid-cols-1 md:grid-cols-9 gap-2 text-sm items-center">
            <div className="md:col-span-2 rounded-lg border border-[var(--color-border)] p-2"><div className="text-[11px] text-[var(--color-text-secondary)]">Raw</div><div className="font-semibold">{rawComposite != null ? rawComposite.toFixed(3) : '—'}</div></div>
            <div className="text-center text-[var(--color-text-secondary)]">→</div>
            <div className="md:col-span-2 rounded-lg border border-[var(--color-border)] p-2"><div className="text-[11px] text-[var(--color-text-secondary)]">Active-weighted</div><div className="font-semibold">{renormalized != null ? renormalized.toFixed(3) : '—'}</div></div>
            <div className="text-center text-[var(--color-text-secondary)]">×</div>
            <div className="md:col-span-2 rounded-lg border border-[var(--color-border)] p-2"><div className="text-[11px] text-[var(--color-text-secondary)]">Agreement</div><div className="font-semibold">{agreementMultiplier != null ? agreementMultiplier.toFixed(2) : '—'}x</div></div>
            <div className="text-center text-[var(--color-text-secondary)]">×</div>
            <div className="md:col-span-2 rounded-lg border border-[var(--color-border)] p-2"><div className="text-[11px] text-[var(--color-text-secondary)]">Extremity</div><div className="font-semibold">{extremityMultiplier != null ? extremityMultiplier.toFixed(2) : '—'}x</div></div>
          </div>
          <div className="mt-3 rounded-lg border border-[var(--color-border)] p-2">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-[var(--color-text-secondary)]">Final Composite</span>
              <span className={`font-semibold ${thresholdTone === 'green' ? 'text-[var(--color-bull)]' : thresholdTone === 'amber' ? 'text-[var(--color-warning)]' : 'text-[var(--color-bear)]'}`}>
                {finalComposite != null ? finalComposite.toFixed(3) : '—'}
              </span>
            </div>
            <div className="h-2 rounded-full bg-[var(--color-surface)] relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-[var(--color-bear)]/35" style={{ width: `${(scalpThreshold / 0.8) * 100}%` }} />
              <div className="absolute inset-y-0 bg-[var(--color-warning)]/35" style={{ left: `${(scalpThreshold / 0.8) * 100}%`, width: `${((fullThreshold - scalpThreshold) / 0.8) * 100}%` }} />
              <div className="absolute inset-y-0 right-0 bg-[var(--color-bull)]/30" style={{ width: `${((0.8 - fullThreshold) / 0.8) * 100}%` }} />
              <div className="absolute -top-1 h-4 w-0.5 bg-[var(--color-text-primary)]" style={{ left: `${Math.max(0, Math.min(100, ((finalComposite ?? 0) / 0.8) * 100))}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">scalp {scalpThreshold.toFixed(2)} · full {fullThreshold.toFixed(2)}{distanceToThreshold != null ? ` · distance to next trigger ${distanceToThreshold.toFixed(3)}` : ''}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-3 bg-[var(--color-surface-subtle)]">
            <div className="flex items-center gap-2 text-[var(--color-text-secondary)] mb-1"><Users size={14} /> Participation</div>
            <div className="font-semibold">{activeCount}/{totalComponents} active — {dormantCount} dormant</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">Active weight: {(activeWeight * 100).toFixed(1)}%</div>
            {activeCount < 8 && <div className="mt-2 text-xs text-[var(--color-warning)]">Thin participation — composite may be unstable.</div>}
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-3 bg-[var(--color-surface-subtle)]">
            <div className="flex items-center gap-2 text-[var(--color-text-secondary)] mb-1"><Target size={14} /> Agreement</div>
            <div className="font-semibold">{agreement != null ? `${(agreement * 100).toFixed(1)}%` : '—'}</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">{agreement != null ? (agreement >= 0.9 ? 'Strong consensus' : agreement >= 0.7 ? 'Moderate consensus' : 'Low consensus') : 'Awaiting aggregation data'}</div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-3 bg-[var(--color-surface-subtle)]">
            <div className="flex items-center gap-2 text-[var(--color-text-secondary)] mb-1"><Info size={14} /> Max Conviction</div>
            <div className="font-semibold">{maxAbsComponent != null ? maxAbsComponent.toFixed(2) : (topComponent?.score != null ? Math.abs(topComponent.score).toFixed(2) : '—')}</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">Driver: {topComponent?.name ?? '—'}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          {agreement != null && agreement < 0.65 && (maxAbsComponent ?? Math.abs(topComponent?.score ?? 0)) >= 0.9 && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-[var(--color-warning)] text-[var(--color-warning)]">
              <AlertTriangle size={12} /> Conflicted signal
            </span>
          )}
          {agreement != null && agreement > 0.85 && activeCount > 12 && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-[var(--color-bull)] text-[var(--color-bull)]">
              Building consensus
            </span>
          )}
        </div>
        <div className="text-sm text-[var(--color-text-secondary)]">
          {finalComposite != null ? `${finalComposite >= 0 ? 'Bullish' : 'Bearish'} setup: ${activeCount}/${totalComponents} components active${agreement != null ? ` with ${(agreement * 100).toFixed(0)}% agreement` : ''}. Strongest driver: ${topComponent?.name ?? 'N/A'}${maxAbsComponent != null ? ` (max conviction ${maxAbsComponent.toFixed(2)})` : ''}. Composite ${finalComposite.toFixed(3)}${nextThreshold != null && distanceToThreshold != null ? ` is ${Math.max(0, distanceToThreshold).toFixed(3)} away from the ${nextThreshold.toFixed(2)} trigger.` : '.'}` : 'Waiting for aggregation data to generate the explain-why summary.'}
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)] h-full min-h-[360px]">
            <div className="text-sm font-semibold mb-2">Component Weights</div>
            <div className="text-xs text-[var(--color-text-secondary)] mb-2">Radar view of all active model component weights (15 total).</div>
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
              {sortedComponents.map((component) => {
                const spectrumPct = component.score != null ? Math.max(0, Math.min(100, (component.score + 100) / 2)) : null;
                return (
                  <div key={component.name} className={`grid grid-cols-[minmax(140px,1.4fr)_0.8fr_0.8fr_0.8fr_minmax(80px,1fr)] gap-2 text-sm py-2 items-center ${component.isDormant ? 'opacity-55' : ''}`}>
                    <button
                      type="button"
                      onClick={() => setSelectedComponent(component.name)}
                      className="font-medium text-left hover:underline flex items-center gap-1.5"
                    >
                      {component.name}
                      {component.isTopByContribution && <span className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--color-warning)] text-[var(--color-warning)]">Top</span>}
                      {component.isDormant && <span className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)]">Dormant</span>}
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
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-0.5 rounded border border-[var(--color-border)]">Bucket: {selectedComponentDetails.bucket}</span>
                <span className="px-2 py-0.5 rounded border border-[var(--color-border)]">Weight: {(selectedComponentDetails.weight * 100).toFixed(0)}%</span>
              </div>
              <p><span className="font-semibold text-[var(--color-text-primary)]">What it is:</span> {selectedComponentDetails.what}</p>
              <p><span className="font-semibold text-[var(--color-text-primary)]">Math:</span> {selectedComponentDetails.math}</p>
              <p><span className="font-semibold text-[var(--color-text-primary)]">Why it matters:</span> {selectedComponentDetails.why}</p>
              <p><span className="font-semibold text-[var(--color-text-primary)]">Abstains when:</span> {selectedComponentDetails.abstains}</p>
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
