/**
 * The strategy catalog's shared view logic.
 *
 * Bot Trading, Backtesting and Pattern Insights render the same catalog, so
 * these helpers are the one place grouping and labelling happen. The tests
 * that matter here are about *not losing information*: a strategy must not
 * vanish from a grouping, and "never screened" must never render as an empty
 * string.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ENGINE_LABELS,
  STAGE_COLOR,
  STAGE_LABELS,
  STAGE_TOOLTIPS,
  evidenceSummary,
  groupByFamily,
  strategiesFromMeta,
} from '../app/backtesting/catalogView.ts';
import type { CatalogStrategy, StrategyStage } from '../app/backtesting/types.ts';

function strategy(over: Partial<CatalogStrategy> = {}): CatalogStrategy {
  return {
    id: 'call_wall_fade',
    name: 'Fade Touches of the Call Wall',
    family: 'wall',
    family_label: 'Wall structure',
    tier: '0DTE',
    direction_mode: 'bearish',
    tagline: 'tagline',
    thesis: 'thesis',
    description: 'thesis',
    stage: 'research',
    engines: ['bot', 'pattern'],
    backtestable: true,
    backtest_via: 'pattern',
    not_backtestable_reason: null,
    provisionable: false,
    bot_id: 'call_wall_rejector',
    pattern_id: 'call_wall_fade',
    supersedes: [],
    superseded_by: null,
    evidence: {
      runs: 0,
      deepest_window_days: 0,
      total_screened_trades: 0,
      has_edge: false,
      conclusive_tuning_generations: 0,
      latest: null,
    },
    retirement: {
      eligible: false,
      blockers: ['deepest screen covers 0d, needs 1825d (5y)'],
      history_progress: 0,
      required_history_days: 1825,
    },
    ...over,
  };
}

// ── Labels ───────────────────────────────────────────────────────────────

test('every stage has a label, a colour and an explanatory tooltip', () => {
  const stages: StrategyStage[] = [
    'research',
    'candidate',
    'validated',
    'superseded',
    'retired',
  ];
  for (const s of stages) {
    assert.ok(STAGE_LABELS[s], `${s} has no label`);
    assert.ok(STAGE_COLOR[s], `${s} has no colour`);
    assert.ok(STAGE_TOOLTIPS[s].length > 40, `${s} tooltip is too thin to explain itself`);
  }
});

test('the research tooltip says explicitly that it is not a failure grade', () => {
  // The catalog's resting state is `research`; if the UI implies that means
  // "failed", 22 of 35 strategies read as rejects.
  assert.match(STAGE_TOOLTIPS.research, /not a verdict/i);
});

test('engine labels cover both engines', () => {
  assert.equal(ENGINE_LABELS.bot, 'Bot');
  assert.equal(ENGINE_LABELS.pattern, 'Pattern');
});

// ── Grouping ─────────────────────────────────────────────────────────────

test('groupByFamily keeps server order and loses nothing', () => {
  const input = [
    strategy({ id: 'a', family: 'wall', family_label: 'Wall structure' }),
    strategy({ id: 'b', family: 'order_flow', family_label: 'Aggressor order flow' }),
    strategy({ id: 'c', family: 'wall', family_label: 'Wall structure' }),
  ];
  const groups = groupByFamily(input);
  assert.deepEqual(
    groups.map((g) => g.family),
    ['wall', 'order_flow'],
  );
  assert.deepEqual(
    groups[0].strategies.map((s) => s.id),
    ['a', 'c'],
  );
  const total = groups.reduce((n, g) => n + g.strategies.length, 0);
  assert.equal(total, input.length, 'a strategy went missing in grouping');
});

test('groupByFamily falls back to an Other bucket rather than dropping a row', () => {
  const groups = groupByFamily([strategy({ family: '', family_label: '' })]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].family, 'other');
  assert.equal(groups[0].label, 'Other');
});

test('groupByFamily handles an empty catalog', () => {
  assert.deepEqual(groupByFamily([]), []);
});

// ── Meta shape tolerance ─────────────────────────────────────────────────

test('strategiesFromMeta prefers the canonical key', () => {
  const a = strategy({ id: 'from_strategies' });
  const b = strategy({ id: 'from_patterns' });
  assert.deepEqual(strategiesFromMeta({ strategies: [a], patterns: [b] }), [a]);
});

test('strategiesFromMeta falls back to the legacy patterns key', () => {
  const b = strategy({ id: 'from_patterns' });
  assert.deepEqual(strategiesFromMeta({ patterns: [b] }), [b]);
});

// ── Evidence summary ─────────────────────────────────────────────────────

test('a never-screened strategy says so rather than rendering blank', () => {
  assert.equal(evidenceSummary(strategy()), 'Never screened');
});

test('a measured screen reads as verdict then numbers', () => {
  const s = strategy({
    evidence: {
      runs: 1,
      deepest_window_days: 45,
      total_screened_trades: 404,
      has_edge: false,
      conclusive_tuning_generations: 1,
      latest: {
        ran_on: '2026-08-09',
        window_days: 45,
        trades: 404,
        verdict: 'no_edge',
        profit_factor: 0.31,
        expectancy: -36.63,
        win_rate: 0.31,
        harness: 'tradeworkz-backtest',
        notes: '',
      },
    },
  });
  assert.equal(evidenceSummary(s), 'no edge · PF 0.31 · 31% win · 404 trades · 45d window');
});

test('an underpowered screen is described as untested, not as no edge', () => {
  const s = strategy({
    evidence: {
      runs: 1,
      deepest_window_days: 60,
      total_screened_trades: 0,
      has_edge: false,
      conclusive_tuning_generations: 0,
      latest: {
        ran_on: '2026-08-15',
        window_days: 60,
        trades: 0,
        verdict: 'underpowered',
        profit_factor: null,
        expectancy: null,
        win_rate: null,
        harness: 'tradeworkz-backtest',
        notes: '',
      },
    },
  });
  const out = evidenceSummary(s);
  assert.match(out, /gates too tight to test/);
  assert.doesNotMatch(out, /no edge/);
});

test('a single trade is not pluralised', () => {
  const s = strategy({
    evidence: {
      runs: 1,
      deepest_window_days: 60,
      total_screened_trades: 1,
      has_edge: false,
      conclusive_tuning_generations: 0,
      latest: {
        ran_on: '2026-08-15',
        window_days: 60,
        trades: 1,
        verdict: 'underpowered',
        profit_factor: null,
        expectancy: null,
        win_rate: null,
        harness: 'tradeworkz-backtest',
        notes: '',
      },
    },
  });
  assert.match(evidenceSummary(s), /1 trade\b/);
});

test('an unrecognised verdict falls through to its raw value', () => {
  const s = strategy({
    evidence: {
      runs: 1,
      deepest_window_days: 10,
      total_screened_trades: 2,
      has_edge: false,
      conclusive_tuning_generations: 0,
      latest: {
        ran_on: '2026-08-15',
        window_days: 10,
        trades: 2,
        // A verdict added server-side before the client knows about it.
        verdict: 'something_new' as never,
        profit_factor: null,
        expectancy: null,
        win_rate: null,
        harness: 'x',
        notes: '',
      },
    },
  });
  assert.match(evidenceSummary(s), /^something_new ·/);
});
