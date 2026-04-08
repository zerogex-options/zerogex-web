'use client';

import { Radar, RadarChart, PolarAngleAxis, PolarGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { useSignalScore } from '@/hooks/useApiData';
import { getRegimeLabel } from '@/core/signalConstants';
import TooltipWrapper from '@/components/TooltipWrapper';

type SignalComponentRow = {
  name: string;
  weight: number;
  score: number | null;
  contribution: number | null;
};

interface SignalScorePanelProps {
  symbol: string;
}

function normalizeComponents(raw: unknown): SignalComponentRow[] {
  const COMPONENT_LABELS: Record<string, string> = {
    gex_regime: 'GEX Regime',
    smart_money: 'Smart Money',
    vol_expansion: 'Vol Expansion',
    opportunity_quality: 'Opportunity Quality',
    gamma_flip: 'Gamma Flip',
    exhaustion: 'Exhaustion',
    put_call_ratio: 'Put/Call Ratio',
  };

  const fallbackComponents: SignalComponentRow[] = [
    { name: 'GEX Regime', weight: 0.18, score: null, contribution: null },
    { name: 'Smart Money', weight: 0.16, score: null, contribution: null },
    { name: 'Vol Expansion', weight: 0.16, score: null, contribution: null },
    { name: 'Opportunity Quality', weight: 0.16, score: null, contribution: null },
    { name: 'Gamma Flip', weight: 0.12, score: null, contribution: null },
    { name: 'Exhaustion', weight: 0.12, score: null, contribution: null },
    { name: 'Put/Call Ratio', weight: 0.10, score: null, contribution: null },
  ];

  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((c) => ({
      name: typeof c?.name === 'string' ? c.name : 'Component',
      weight: typeof c?.weight === 'number' ? c.weight : 0,
      score: typeof c?.score === 'number' ? c.score : null,
      contribution: typeof c?.contribution === 'number' ? c.contribution : null,
    }));
  }

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const dict = raw as Record<string, { score?: number; weight?: number; contribution?: number }>;
    return Object.entries(dict).map(([key, value]) => ({
      name: COMPONENT_LABELS[key] ?? key,
      weight: value.weight ?? 0,
      score: typeof value.score === 'number' ? value.score : null,
      contribution: typeof value.contribution === 'number' ? value.contribution : null,
    }));
  }

  return fallbackComponents;
}

export default function SignalScorePanel({ symbol }: SignalScorePanelProps) {
  const { data: scoreData } = useSignalScore(symbol, 10000);
  const components = normalizeComponents(scoreData?.components);
  const radarData = components.map((component) => ({
    axis: component.name,
    weightScore: Math.max(0, Math.min(100, component.weight * 100)),
    description: `${Math.round(component.weight * 100)}% model weighting`,
  }));

  return (
    <>
      <div className="zg-feature-shell p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)] mb-2 flex items-center gap-2">
              Current Market Feel
              <TooltipWrapper text="Weighted composite of 7 signals (GEX regime, smart money, vol expansion, opportunity quality, gamma flip, exhaustion, put/call ratio). Positive = bullish, negative = bearish, magnitude = conviction." placement="bottom">
                <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
              </TooltipWrapper>
            </div>
            {(() => {
              const compositeScore = scoreData?.composite_score ?? scoreData?.score;
              const hasScore = typeof compositeScore === 'number';
              const directionLabel = hasScore ? getRegimeLabel(compositeScore!) : 'Awaiting signal data';

              return (
                <>
                  <div
                    className="text-6xl font-black leading-none"
                    style={{
                      color: hasScore
                        ? (compositeScore! > 0 ? 'var(--color-bull)' : compositeScore! < 0 ? 'var(--color-bear)' : 'var(--color-warning)')
                        : 'var(--color-text-primary)',
                    }}
                  >
                    {hasScore ? compositeScore!.toFixed(2) : '--'}
                  </div>
                  <div className="mt-2 text-lg font-semibold">{directionLabel}</div>
                </>
              );
            })()}
            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
              Aggregate weighted conviction of seven independent market signals (−100 to +100). Positive = net bullish evidence, negative = net bearish. The normalized score (absolute value, 0–100) represents pure conviction strength regardless of direction.
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
                    typeof (scoreData?.composite_score ?? scoreData?.score) === 'number'
                      ? `${Math.max(0, Math.min(100, ((scoreData?.composite_score ?? scoreData?.score)! + 100) / 2))}%`
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
          <div className="lg:col-span-2 rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)] h-[320px]">
            <div className="text-sm font-semibold mb-2">Component Weights</div>
            <div className="text-xs text-[var(--color-text-secondary)] mb-2">Radar view of 7-component weighting model</div>
            <ResponsiveContainer width="100%" height="86%">
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid stroke="var(--color-border)" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
                <Radar dataKey="weightScore" stroke="var(--color-warning)" fill="var(--color-warning)" fillOpacity={0.45} />
                <Tooltip
                  contentStyle={{ background: 'var(--color-chart-tooltip-bg)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-chart-tooltip-text)' }}
                  formatter={(value, _n, item) => [`${Number(value).toFixed(0)}%`, String((item.payload as { description?: string }).description ?? '')]}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="lg:col-span-3 rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
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
                    <span className="font-medium">{component.name}</span>
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
    </>
  );
}
