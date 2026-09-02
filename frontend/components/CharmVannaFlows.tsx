'use client';

import Link from 'next/link';
import { Info, Lock } from 'lucide-react';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import { capture } from '@/core/telemetry/posthog-client';
import { TelemetryEvent } from '@/core/telemetry/events';
import type { SignalAvailability } from '@/core/signalAvailability';
import TooltipWrapper from './TooltipWrapper';
import ExpandableCard from './ExpandableCard';
import ChartCaption from "./ChartCaption";

interface ByStrikeRow {
  vanna_exposure?: number | null;
  charm_exposure?: number | null;
}

interface VolExpansionData {
  expansion?: number | null;
}

interface CharmVannaFlowsProps {
  byStrikeData: ByStrikeRow[] | null | undefined;
  volExpansion: VolExpansionData | null | undefined;
  /** Why `volExpansion` is empty, when it is. Optional: omitted, the row falls
   *  back to the old data-presence-only read, so any caller that hasn't been
   *  plumbed through still renders exactly what it did before. */
  volExpansionState?: SignalAvailability;
  /** Named in the "no coverage for this symbol" copy. */
  symbol?: string;
}

// Tier id -> the name the plan goes by on /pricing. Kept local and total:
// an unmapped id falls back to the raw value rather than rendering "undefined".
const PLAN_LABELS: Record<string, string> = {
  basic: 'Basic',
  pro: 'Pro',
  admin: 'Admin',
  public: 'a free account',
};

function formatB(value: number): string {
  const abs = Math.abs(value);
  const sign = value >= 0 ? '+' : '';
  if (abs >= 1e9) return `${sign}${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${(value / 1e6).toFixed(0)}M`;
  return `${sign}${(value / 1e3).toFixed(0)}K`;
}

function getFlowDescription(value: number, type: 'vanna' | 'charm' | 'eod_charm'): string {
  const abs = Math.abs(value);
  if (type === 'vanna') {
    if (value > 1e8) return 'Supports rally on vol crush';
    if (value < -1e8) return 'Supports selloff on vol crush';
    return 'Neutral vanna flow';
  }
  if (type === 'charm') {
    if (abs < 1e8) return 'Mild call decay, neutral';
    if (value > 0) return 'Put decay adding upside delta';
    return 'Call decay adding downside delta';
  }
  // eod_charm
  if (value > 1e8) return 'EOD buy pressure expected';
  if (value < -1e8) return 'EOD sell pressure expected';
  return 'Neutral EOD charm effect';
}

function FlowBar({ value, maxAbs, isDark }: { value: number; maxAbs: number; isDark: boolean }) {
  const width = maxAbs > 0 ? Math.min(100, (Math.abs(value) / maxAbs) * 100) : 0;
  const barColor = value >= 0 ? 'var(--color-bull)' : 'var(--color-bear)';

  return (
    <div
      className="h-5 rounded-full overflow-hidden flex-shrink-0"
      style={{
        width: '100px',
        backgroundColor: isDark ? 'var(--border-subtle)' : 'var(--border-subtle)',
      }}
    >
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{
          width: `${Math.max(4, width)}%`,
          backgroundColor: barColor,
        }}
      />
    </div>
  );
}

export default function CharmVannaFlows({
  byStrikeData,
  volExpansion,
  volExpansionState,
  symbol,
}: CharmVannaFlowsProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const textColor = 'var(--text-primary)';

  const rows = byStrikeData || [];
  const totalVanna = rows.reduce((sum, r) => sum + Number(r.vanna_exposure || 0), 0);
  const totalCharm = rows.reduce((sum, r) => sum + Number(r.charm_exposure || 0), 0);
  const eodCharm = totalCharm * 0.6; // EOD charm approximation (accelerated into close)

  const maxAbs = Math.max(Math.abs(totalVanna), Math.abs(totalCharm), Math.abs(eodCharm), 1);

  const expansion = volExpansion?.expansion ?? null;
  const hasExpansion = expansion != null && Number.isFinite(expansion);

  // The vol-expansion row reports one of two different kinds of thing: a
  // reading, or the reason there isn't one.
  //
  // A reading is classified only when `expansion` is actually present —
  // this used to render "Low / GEX suppressing vol" for a missing value,
  // which falsely implied a healthy signal on cycles where none existed.
  //
  // The reason, when there is no reading, has to be specific. A bare "N/A"
  // is the same cell whether the viewer lacks the tier, the symbol has no
  // coverage, or the signal engine is down — three problems with three
  // different owners and three different fixes, and it once sent a working
  // paywall to support as a bug report. That paywall is gone (the reading is
  // a Basic entitlement now), which makes the distinction MORE important, not
  // less: a Basic viewer is expected to see a value here, so an empty row is
  // now far likelier to be a genuine fault than a gate. See
  // core/signalAvailability.ts for how the state is derived.
  const volRisk = ((): {
    label: string;
    caption: string;
    color: string;
    barPct: number | null;
    locked: boolean;
  } => {
    if (hasExpansion) {
      const value = expansion as number;
      if (value >= 60) {
        return {
          label: 'High',
          caption: 'Vol breakout likely',
          color: 'var(--color-bear)',
          barPct: 85,
          locked: false,
        };
      }
      if (value >= 30) {
        return {
          label: 'Medium',
          caption: 'Moderate expansion risk',
          color: 'var(--color-warning)',
          barPct: 50,
          locked: false,
        };
      }
      return {
        label: 'Low',
        caption: 'GEX suppressing vol',
        color: 'var(--text-secondary)',
        barPct: 20,
        locked: false,
      };
    }

    const muted = 'var(--text-secondary)';
    switch (volExpansionState?.kind) {
      case 'locked': {
        // Named, not blanked — the honest message is which plan carries this
        // row, not silence that reads as breakage. Derived from the state's
        // requiredTier rather than hardcoded: this row's own gate moved from
        // Pro to Basic, and copy that names the wrong plan is worse than the
        // silence it replaced.
        const plan = volExpansionState?.kind === 'locked'
          ? PLAN_LABELS[volExpansionState.requiredTier] ?? volExpansionState.requiredTier
          : 'Pro';
        return { label: plan, caption: `Included with ${plan}`, color: muted, barPct: null, locked: true };
      }
      case 'unsupported':
        return {
          label: 'N/A',
          caption: symbol ? `No coverage for ${symbol}` : 'No coverage for this symbol',
          color: muted,
          barPct: null,
          locked: false,
        };
      case 'error':
        // Deliberately NOT "N/A": an outage should look like an outage, both
        // to the viewer and to whoever they send the screenshot to.
        return { label: '—', caption: 'Signal temporarily unavailable', color: muted, barPct: null, locked: false };
      case 'resolving':
        return { label: '—', caption: 'Checking availability…', color: muted, barPct: null, locked: false };
      default:
        // 'ready' with no value, or no state passed at all (the pre-existing
        // caller contract) — the backend answered and simply had no reading.
        return { label: 'N/A', caption: 'No expansion signal available', color: muted, barPct: null, locked: false };
    }
  })();

  const flowItems = [
    {
      title: 'Vanna (vol\u2192delta)',
      description: getFlowDescription(totalVanna, 'vanna'),
      value: totalVanna,
      color: totalVanna >= 0 ? 'var(--color-bull)' : 'var(--color-bear)',
    },
    {
      title: 'Charm (time\u2192delta)',
      description: getFlowDescription(totalCharm, 'charm'),
      value: totalCharm,
      color: totalCharm >= 0 ? 'var(--color-bull)' : 'var(--color-bear)',
    },
    {
      title: 'End-of-day charm',
      description: getFlowDescription(eodCharm, 'eod_charm'),
      value: eodCharm,
      color: eodCharm >= 0 ? 'var(--color-bull)' : 'var(--color-bear)',
    },
  ];

  return (
    <ExpandableCard expandTrigger="button" expandButtonLabel="Expand chart" className="h-full">
      <div
        className="rounded-2xl p-6 h-full"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: `1px solid var(--border-default)`,
        }}
      >
      <div className="flex items-center gap-2 mb-5">
        <h3
          className="zg-h3"
          style={{ color: textColor }}
        >
          Charm &amp; Vanna Flows
        </h3>
        <TooltipWrapper text="Shows aggregate vanna and charm exposures across the chain, plus an end-of-day charm estimate to indicate potential hedging pressure into the close.">
          <Info size={14} />
        </TooltipWrapper>
      </div>

      <div className="flex flex-col gap-5">
        {flowItems.map((item) => (
          <div key={item.title} className="flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold" style={{ color: textColor }}>{item.title}</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.description}</div>
            </div>
            <div className="text-sm font-bold whitespace-nowrap" style={{ color: item.color }}>
              {formatB(item.value)}
            </div>
            <FlowBar value={item.value} maxAbs={maxAbs} isDark={isDark} />
          </div>
        ))}

        {/* Vol expansion risk */}
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: textColor }}>Vol expansion risk</div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {volRisk.caption}
              {volRisk.locked && (
                <>
                  {' \u00b7 '}
                  <Link
                    href="/pricing?plan=pro"
                    onClick={() => capture(TelemetryEvent.LockedFeatureCtaClick, {
                      feature: 'vol_expansion',
                      required_tier: volExpansionState?.kind === 'locked'
                        ? volExpansionState.requiredTier
                        : 'pro',
                      symbol,
                    })}
                    className="underline underline-offset-2"
                    style={{ color: 'var(--color-brand-accent)' }}
                  >
                    Upgrade
                  </Link>
                </>
              )}
            </div>
          </div>
          <div
            className="text-sm font-bold italic whitespace-nowrap flex items-center gap-1"
            style={{ color: volRisk.color }}
          >
            {volRisk.locked && <Lock size={12} aria-hidden />}
            {volRisk.label}
          </div>
          <div
            className="h-5 rounded-full flex-shrink-0"
            style={{
              width: '100px',
              backgroundColor: isDark ? 'var(--border-subtle)' : 'var(--border-subtle)',
            }}
          >
            {volRisk.barPct != null && (
              <div
                className="h-full rounded-full"
                style={{
                  width: `${volRisk.barPct}%`,
                  backgroundColor: volRisk.color,
                  opacity: 0.6,
                }}
              />
            )}
          </div>
        </div>
      </div>
      <ChartCaption />
      </div>
    </ExpandableCard>
  );
}
