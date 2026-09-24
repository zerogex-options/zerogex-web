/**
 * Pure view logic for the strategy catalog — labels, tooltips, grouping.
 *
 * Split out from `catalogView.tsx` so a node test can exercise it without
 * JSX handling (the same reason `insights/view.ts` exists). The React badge
 * components live in the .tsx and import from here.
 *
 * Mirrors `src/strategies` on the engine server: stage describes EVIDENCE,
 * engines describe which surface can run a strategy, and "backtestable" says
 * whether it can be measured at all.
 */

import type {
  BacktestRoute,
  CatalogStrategy,
  StrategyEngine,
  StrategyStage,
} from './types';

export const STAGE_LABELS: Record<StrategyStage, string> = {
  research: 'Research',
  candidate: 'Candidate',
  validated: 'Validated',
  superseded: 'Superseded',
  retired: 'Retired',
};

/**
 * What each stage means, in the user's terms. Deliberately explicit that
 * "research" is the normal resting state and not a failure grade — most of
 * the catalog sits there because the evidence bar for anything else is high.
 */
export const STAGE_TOOLTIPS: Record<StrategyStage, string> = {
  research:
    'In the catalog and being actively refined. No edge established yet\u00a0- this is the ' +
    'normal resting state, not a verdict.',
  candidate:
    'A screen shows promise but has not cleared the promotion gate ' +
    '(profit factor ≥ 1.1 with positive expectancy over ≥ 20 trades).',
  validated:
    'Cleared the promotion gate on measured, realized P&L. Eligible for live capital ' +
    'once a bot implements it.',
  superseded:
    'Replaced by a better implementation of the same thesis. Not a verdict on the ' +
    'idea\u00a0- the successor carries it forward.',
  retired:
    'Exhausted: five years of history and repeated retuning found no edge. The only ' +
    'terminal state, and deliberately hard to reach.',
};

/** Stage → a theme colour var. Research is intentionally neutral. */
export const STAGE_COLOR: Record<StrategyStage, string> = {
  research: 'var(--color-text-secondary)',
  candidate: 'var(--color-warning)',
  validated: 'var(--color-bull)',
  superseded: 'var(--color-text-secondary)',
  retired: 'var(--color-bear)',
};

export const ENGINE_LABELS: Record<StrategyEngine, string> = {
  bot: 'Bot',
  pattern: 'Pattern',
};

export const ENGINE_TOOLTIPS: Record<StrategyEngine, string> = {
  bot: 'A TradeWorkz bot implements this strategy\u00a0- it can trade it live and be replayed over history.',
  pattern: 'A playbook pattern implements this strategy\u00a0- it emits Action Cards live.',
};

export const ROUTE_TOOLTIPS: Record<BacktestRoute, string> = {
  pattern:
    "Measured by replaying the Action Cards this strategy actually emitted live\u00a0- the " +
    'strongest claim available.',
  bot_replay:
    "Measured by replaying the bot's own entry rule against the market as it looked at " +
    'each past instant. Same pricing, fills and slippage as every other backtest; the ' +
    'entries are reconstructed rather than having fired live.',
};

export interface StrategyGroup {
  family: string;
  label: string;
  strategies: CatalogStrategy[];
}

/**
 * Group the catalog by thesis family, preserving the server's ordering
 * (family, then tier, then name) so the picker is stable between loads.
 */
export function groupByFamily(strategies: CatalogStrategy[]): StrategyGroup[] {
  const groups: StrategyGroup[] = [];
  const index = new Map<string, StrategyGroup>();
  for (const s of strategies) {
    const key = s.family || 'other';
    let group = index.get(key);
    if (!group) {
      group = { family: key, label: s.family_label || 'Other', strategies: [] };
      index.set(key, group);
      groups.push(group);
    }
    group.strategies.push(s);
  }
  return groups;
}

/** The catalog list from meta, tolerating either key. */
export function strategiesFromMeta(meta: {
  strategies?: CatalogStrategy[];
  patterns: CatalogStrategy[];
}): CatalogStrategy[] {
  return meta.strategies ?? meta.patterns ?? [];
}

/**
 * One line of measured evidence, or an explicit statement that there is none.
 * Never renders an empty string: "never screened" is information.
 */
export function evidenceSummary(s: CatalogStrategy): string {
  const latest = s.evidence.latest;
  if (!latest) return 'Never screened';
  const bits: string[] = [];
  if (latest.profit_factor != null) bits.push(`PF ${latest.profit_factor.toFixed(2)}`);
  if (latest.win_rate != null) bits.push(`${Math.round(latest.win_rate * 100)}% win`);
  bits.push(`${latest.trades} trade${latest.trades === 1 ? '' : 's'}`);
  bits.push(`${latest.window_days}d window`);
  const verdictLabel: Record<string, string> = {
    edge: 'edge found',
    no_edge: 'no edge',
    insufficient: 'sample too small',
    underpowered: 'gates too tight to test',
    invalid: 'run invalidated',
  };
  return `${verdictLabel[latest.verdict] ?? latest.verdict} · ${bits.join(' · ')}`;
}
