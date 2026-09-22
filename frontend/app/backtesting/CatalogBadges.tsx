/**
 * Shared badge components for the strategy catalog.
 *
 * Bot Trading, Backtesting and Pattern Insights all render the same 35
 * strategies, so the badges live here rather than being re-derived (and
 * drifting) on each page. The labels, tooltips and grouping they read are in
 * the `catalogView.ts` sibling, which is unit-testable without JSX.
 */

import type { BacktestRoute, StrategyEngine, StrategyStage } from './types';
import {
  ENGINE_LABELS,
  ENGINE_TOOLTIPS,
  ROUTE_TOOLTIPS,
  STAGE_COLOR,
  STAGE_LABELS,
  STAGE_TOOLTIPS,
} from './catalogView';

interface PillProps {
  children: React.ReactNode;
  color?: string;
  title?: string;
}

function Pill({ children, color = 'var(--color-text-secondary)', title }: PillProps) {
  return (
    <span
      title={title}
      className="inline-flex items-center px-1.5 py-0.5 text-[9px] uppercase whitespace-nowrap"
      style={{
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        letterSpacing: '0.08em',
        color,
        border: `1px solid ${color}`,
        borderRadius: 'var(--radius-control)',
        lineHeight: 1.1,
      }}
    >
      {children}
    </span>
  );
}

export function StageBadge({ stage }: { stage: StrategyStage }) {
  return (
    <Pill color={STAGE_COLOR[stage]} title={STAGE_TOOLTIPS[stage]}>
      {STAGE_LABELS[stage]}
    </Pill>
  );
}

export function EngineBadges({ engines }: { engines: StrategyEngine[] }) {
  if (!engines.length) {
    return (
      <Pill title="No engine implements this strategy yet, so it cannot be traded or measured.">
        No engine
      </Pill>
    );
  }
  return (
    <>
      {engines.map((e) => (
        <Pill key={e} title={ENGINE_TOOLTIPS[e]}>
          {ENGINE_LABELS[e]}
        </Pill>
      ))}
    </>
  );
}

/**
 * How a strategy is measured. Rendered only for `bot_replay`, because that is
 * the case a reader needs told about — a pattern replay is the default and
 * saying so on 18 rows is noise.
 */
export function RouteBadge({ route }: { route: BacktestRoute | null }) {
  if (route !== 'bot_replay') return null;
  return (
    <Pill color="var(--color-accent)" title={ROUTE_TOOLTIPS.bot_replay}>
      Replay
    </Pill>
  );
}
