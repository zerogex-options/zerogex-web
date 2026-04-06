'use client';

import { useSignalScore } from '@/hooks/useApiData';
import { getRegimeLabel, getStrengthLabel } from '@/core/signalConstants';

interface SignalScorePanelProps {
  symbol: string;
}

export default function SignalScorePanel({ symbol }: SignalScorePanelProps) {
  const { data: scoreData } = useSignalScore(symbol, 10000);

  return (
    <div className="zg-feature-shell p-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)] mb-2">Current Market Feel</div>
          {(() => {
            const compositeScore = scoreData?.composite_score ?? scoreData?.score;
            const hasScore = typeof compositeScore === 'number';
            const absScore = hasScore ? Math.abs(compositeScore!) : 0;
            const strength = hasScore ? getStrengthLabel(absScore) : null;
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
                {hasScore && strength && (
                  <div className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full" style={{
                    background: strength === 'high' ? 'rgba(27,196,125,0.15)' : strength === 'medium' ? 'rgba(255,166,0,0.15)' : 'rgba(255,77,90,0.15)',
                    color: strength === 'high' ? 'var(--color-bull)' : strength === 'medium' ? 'var(--color-warning)' : 'var(--color-bear)',
                  }}>
                    {strength === 'high' ? 'High Conviction' : strength === 'medium' ? 'Medium Conviction' : 'Low Conviction'}
                    {' · '}|score| = {absScore.toFixed(2)}
                  </div>
                )}
              </>
            );
          })()}
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
            Composite score from the UnifiedSignalEngine (−1.0 to +1.0). Weighted sum of 6 components: GEX regime, vol expansion, smart money, exhaustion, gamma flip, and put/call ratio. Sign encodes direction; magnitude encodes conviction.
          </p>
        </div>

        <div className="lg:col-span-3 rounded-xl border border-[var(--color-border)] p-5 bg-[var(--color-surface-subtle)]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">Score Spectrum</div>
            <div className="text-xs text-[var(--color-text-secondary)]">Range: −1.0 to +1.0</div>
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
            <div className="absolute top-0 h-4 w-px bg-[var(--color-text-primary)] opacity-25" style={{ left: '32.5%' }} />
            <div className="absolute top-0 h-4 w-px bg-[var(--color-text-primary)] opacity-25" style={{ left: '67.5%' }} />
            <div
              className="absolute -top-2 h-8 w-0.5 bg-[var(--color-text-primary)]"
              style={{
                left:
                  typeof (scoreData?.composite_score ?? scoreData?.score) === 'number'
                    ? `${Math.max(0, Math.min(100, (((scoreData?.composite_score ?? scoreData?.score)! + 1) / 2) * 100))}%`
                    : '50%',
                transform: 'translateX(-50%)',
              }}
            />
          </div>

          <div className="mt-3 grid grid-cols-5 text-[11px] text-[var(--color-text-secondary)]">
            <span className="text-left">−1.0</span>
            <span className="text-center">−0.58</span>
            <span className="text-center">0</span>
            <span className="text-center">+0.58</span>
            <span className="text-right">+1.0</span>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
            <div className="rounded-lg border border-[var(--color-border)] p-2.5 bg-[var(--color-surface)]">
              <div className="font-semibold text-[var(--color-bear)]">Strong Bear</div>
              <div className="text-[var(--color-text-secondary)] mt-1">−1.0 to −0.58: open bearish trades.</div>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] p-2.5 bg-[var(--color-surface)]">
              <div className="font-semibold text-[var(--color-bear)] opacity-70">Weak Bear</div>
              <div className="text-[var(--color-text-secondary)] mt-1">−0.58 to −0.35: hold, don&apos;t add.</div>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] p-2.5 bg-[var(--color-surface)]">
              <div className="font-semibold text-[var(--color-warning)]">Neutral</div>
              <div className="text-[var(--color-text-secondary)] mt-1">−0.35 to +0.35: no edge, cut size.</div>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] p-2.5 bg-[var(--color-surface)]">
              <div className="font-semibold text-[var(--color-bull)] opacity-70">Weak Bull</div>
              <div className="text-[var(--color-text-secondary)] mt-1">+0.35 to +0.58: hold, don&apos;t add.</div>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] p-2.5 bg-[var(--color-surface)]">
              <div className="font-semibold text-[var(--color-bull)]">Strong Bull</div>
              <div className="text-[var(--color-text-secondary)] mt-1">+0.58 to +1.0: open bullish trades.</div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
            <div className="text-[11px] font-semibold text-[var(--color-text-secondary)] mb-2">Signal Components</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {(() => {
                const COMPONENT_LABELS: Record<string, string> = {
                  gex_regime: 'GEX Regime',
                  vol_expansion: 'Vol Expansion',
                  smart_money: 'Smart Money',
                  exhaustion: 'Exhaustion',
                  gamma_flip: 'Gamma Flip',
                  put_call_ratio: 'Put/Call Ratio',
                };
                const fallbackComponents: { name: string; weight: number; score?: number }[] = [
                  { name: 'GEX Regime', weight: 0.22 },
                  { name: 'Vol Expansion', weight: 0.20 },
                  { name: 'Smart Money', weight: 0.16 },
                  { name: 'Exhaustion', weight: 0.15 },
                  { name: 'Gamma Flip', weight: 0.15 },
                  { name: 'Put/Call Ratio', weight: 0.12 },
                ];

                let components = fallbackComponents;
                const raw = scoreData?.components;
                if (Array.isArray(raw) && raw.length > 0) {
                  components = raw.map((c) => ({ name: c.name, weight: c.weight, score: c.score }));
                } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
                  const dict = raw as Record<string, { score?: number; weight?: number }>;
                  components = Object.entries(dict).map(([key, val]) => ({
                    name: COMPONENT_LABELS[key] ?? key,
                    weight: val.weight ?? 0,
                    score: val.score,
                  }));
                }

                return components.map((comp) => {
                  const hasScore = 'score' in comp && typeof comp.score === 'number';
                  const score = hasScore ? (comp as { score: number }).score : null;
                  const pct = score != null ? Math.max(0, Math.min(100, ((score + 1) / 2) * 100)) : null;
                  const barColor =
                    score != null
                      ? score > 0.1
                        ? 'var(--color-bull)'
                        : score < -0.1
                          ? 'var(--color-bear)'
                          : 'var(--color-warning)'
                      : undefined;

                  return (
                    <div key={comp.name} className="flex items-center gap-2">
                      <div className="flex-shrink-0 w-[120px] text-[11px] text-[var(--color-text-secondary)] truncate">
                        {comp.name} <span className="opacity-60">({Math.round(comp.weight * 100)}%)</span>
                      </div>
                      <div className="relative flex-1 h-2 rounded-full" style={{
                        opacity: hasScore ? 1 : 0.25,
                      }}>
                        <div className="absolute inset-0 rounded-full" style={{
                          background:
                            'linear-gradient(90deg, var(--color-bear) 0%, var(--color-warning) 50%, var(--color-bull) 100%)',
                        }} />
                        {pct != null && (
                          <div
                            className="absolute w-0.5 rounded-full"
                            style={{
                              left: `${pct}%`,
                              top: '-3px',
                              height: '14px',
                              transform: 'translateX(-50%)',
                              backgroundColor: 'var(--color-text-primary)',
                              boxShadow: '0 0 2px rgba(0,0,0,0.5)',
                            }}
                          />
                        )}
                      </div>
                      <div className="flex-shrink-0 w-[36px] text-right text-[11px] font-mono" style={{ color: barColor ?? 'var(--color-text-secondary)' }}>
                        {score != null ? (score >= 0 ? '+' : '') + score.toFixed(2) : '—'}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
