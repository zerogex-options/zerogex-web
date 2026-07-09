'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  Download,
  Gauge,
  History,
  LayoutGrid,
  Layers,
  LineChart as LineChartIcon,
  ListOrdered,
  Play,
  Save,
  Search,
  Share2,
  Shuffle,
  SlidersHorizontal,
  TrendingUp,
  Trash2,
} from 'lucide-react';
import TooltipWrapper from '@/components/TooltipWrapper';
import BetaBadge from '@/components/BetaBadge';
import { backtestAPI } from '@/core/api/endpoints';
import { useBacktest, TRADES_PAGE_SIZE } from './useBacktest';
import type {
  BacktestCondition,
  BacktestConfigSummary,
  BacktestMeta,
  BacktestRegimeBreakdown,
  BacktestSpec,
  BacktestStrategyField,
  BacktestSummary,
  BacktestSweep,
  BacktestSweepAxis,
  BacktestSweepParam,
  StrategyStructureId,
} from './types';

// Sweep grid bound mirrored from the backend (src/backtesting/sweeps.py).
const SWEEP_MAX_CELLS = 24;

// Structures that are non-directional (exit on the premium overlay only).
const NEUTRAL_STRUCTURES: StrategyStructureId[] = ['straddle', 'strangle', 'condor'];
function isNeutral(id: StrategyStructureId): boolean {
  return NEUTRAL_STRUCTURES.includes(id);
}

// Recharts is heavy; the equity curve sits below the config panel and only
// appears once a run completes. Split it out so the form paints immediately.
const EquityChart = dynamic(() => import('./EquityChart'), {
  ssr: false,
  loading: () => <Skeleton height={320} label="Loading chart…" />,
});

const MonteCarloChart = dynamic(() => import('./MonteCarloChart'), {
  ssr: false,
  loading: () => <Skeleton height={280} label="Loading simulation…" />,
});

const TITLE_TOOLTIP =
  'Backtest a basket of signal patterns against historical option data. ' +
  'Configure the underlying, date range, patterns, fill model, and sizing, then run. ' +
  'Results include an equity curve, per-pattern breakdown, and a full trade blotter.';

// ---- Local form state ----------------------------------------------------

/** A condition row as edited in the form — all fields are strings until submit. */
interface FormCondition {
  field: string;
  op: string;
  value: string;
}

interface FormState {
  mode: 'patterns' | 'strategy';
  underlying: string;
  start_date: string;
  end_date: string;
  patterns: string[];
  // Custom-strategy mode
  direction: 'bullish' | 'bearish';
  conditions: FormCondition[];
  structure: StrategyStructureId;
  width: string;
  wing: string;
  dte: string;
  target_offset_pct: string; // percent, empty => off (underlying-price offset)
  stop_offset_pct: string; // percent, empty => off (underlying-price offset)
  capital: number;
  risk_per_trade_pct: number;
  slippage_pct: number;
  commission_per_contract: number;
  max_concurrent: number;
  max_net_delta: string; // empty => off
  max_net_vega: string; // empty => off
  max_hold_minutes: string; // empty string => null (no cap)
  profit_target_pct: string; // percent, empty => off (e.g. "50" = +50%)
  stop_loss_pct: string; // percent, empty => off (e.g. "50" = −50%)
}

/** A blank condition row seeded from the first available strategy field. */
function blankCondition(meta: BacktestMeta): FormCondition {
  const first = meta.strategy_fields[0];
  return {
    field: first?.field ?? '',
    op: first?.ops[0] ?? '',
    value: '',
  };
}

function buildInitialForm(meta: BacktestMeta): FormState {
  const d = meta.defaults;
  return {
    mode: 'patterns',
    underlying: meta.underlyings[0] ?? '',
    start_date: meta.data_window.earliest,
    end_date: meta.data_window.latest,
    patterns: [],
    direction: 'bullish',
    conditions: [blankCondition(meta)],
    structure: 'single',
    width: String(meta.defaults.width ?? 5),
    wing: String(meta.defaults.wing ?? 5),
    dte: '0',
    target_offset_pct: '',
    stop_offset_pct: '',
    capital: d.capital,
    risk_per_trade_pct: d.risk_per_trade_pct,
    slippage_pct: d.slippage_pct,
    commission_per_contract: d.commission_per_contract,
    max_concurrent: d.max_concurrent,
    max_net_delta: '',
    max_net_vega: '',
    max_hold_minutes: '',
    profit_target_pct: '',
    stop_loss_pct: '',
  };
}

// ---- Featured strategies -------------------------------------------------
//
// A small, hand-curated list of strategies with measured edge on the realized-
// P&L calibration backtest. Clicking one hydrates the form with that spec so a
// subscriber can run it in one click. New entries are appended here — datafied
// so additions are a single object literal, not a UI change.

/** One featured strategy entry. Patterns-mode only for v1. */
interface FeaturedStrategy {
  id: string;
  name: string;
  /** One-line subtitle shown under the name in the picker. */
  blurb: string;
  /** Subscriber-visible justification — measured backtest numbers. */
  evidence: string;
  underlying: string;
  patterns: string[];
  /** Date window: end = latest available, start = end − this many days. */
  lookbackDays: number;
}

/**
 * v1 features the single pattern with conclusive realized-P&L edge —
 * gex_gradient_trend / QQQ (n=33, win 64%, PF 2.80, +$2,411 expectancy on the
 * standardized single-long calibration backtest). Others are watched but not
 * promoted: call_wall_fade/SPY is positive but smaller; put_wall_bounce/SPY/QQQ
 * looks excellent but samples are still thin (n=14, n=5).
 */
const FEATURED_STRATEGIES: FeaturedStrategy[] = [
  {
    id: 'gex-gradient-trend-qqq',
    name: 'GEX Gradient Trend · QQQ',
    blurb: 'Long ATM calls/puts on QQQ when the gamma-gradient drift fires.',
    evidence:
      'Realized-P&L backtest, last 60 days: 64% win rate over 33 trades, ' +
      'profit factor 2.80, expectancy +$2,411 per trade (net of fills, ' +
      'slippage, and commission). Past performance does not guarantee future ' +
      'returns.',
    underlying: 'QQQ',
    patterns: ['gex_gradient_trend'],
    lookbackDays: 60,
  },
];

/**
 * Subtract `days` from an ISO date (YYYY-MM-DD), returning ISO. Stays in the
 * local-date space (no timezone shifts) so calendar math is stable across DST.
 */
function subtractDaysISO(dateISO: string, days: number): string {
  // Parse as a UTC date so .setUTCDate() doesn't get pushed across a DST
  // boundary, then format back to YYYY-MM-DD.
  const d = new Date(`${dateISO}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Build a FormState for a featured strategy. Falls back to the meta defaults
 * for anything the entry doesn't override; clamps the start date to the
 * available `data_window.earliest` so the API doesn't 409 on a window outside
 * the archived range.
 */
function featuredToForm(s: FeaturedStrategy, meta: BacktestMeta): FormState {
  const base = buildInitialForm(meta);
  const end = meta.data_window.latest;
  const wantStart = subtractDaysISO(end, s.lookbackDays);
  const start = wantStart < meta.data_window.earliest ? meta.data_window.earliest : wantStart;
  return {
    ...base,
    mode: 'patterns',
    underlying: meta.underlyings.includes(s.underlying) ? s.underlying : base.underlying,
    patterns: s.patterns.slice(),
    start_date: start,
    end_date: end,
  };
}

/** Positive number string → number; blank/invalid/≤0 → null (off). */
function posOrNull(value: string): number | null {
  const t = value.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Percent string → fraction (e.g. "50" → 0.5); blank/invalid → null (off). */
function pctToFraction(value: string): number | null {
  const t = value.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n / 100 : null;
}

/** A condition row is "complete" once it has a field, an op, and a value. */
function isConditionComplete(c: FormCondition): boolean {
  return c.field !== '' && c.op !== '' && c.value.trim() !== '';
}

/**
 * Coerce a form condition's value to the type its field declares: number for
 * numeric fields, the raw string for categorical fields.
 */
function conditionToSpec(c: FormCondition, meta: BacktestMeta): BacktestCondition {
  const def = meta.strategy_fields.find((f) => f.field === c.field);
  const value: number | string =
    def?.type === 'numeric' ? Number(c.value) : c.value;
  return { field: c.field, op: c.op, value };
}

function formToSpec(form: FormState, meta: BacktestMeta): BacktestSpec {
  const parsedHold = form.max_hold_minutes.trim() === '' ? null : Number(form.max_hold_minutes);
  const spec: BacktestSpec = {
    underlying: form.underlying,
    start_date: form.start_date,
    end_date: form.end_date,
    fill_model: {
      slippage_pct: form.slippage_pct,
      commission_per_contract: form.commission_per_contract,
    },
    sizing: {
      capital: form.capital,
      risk_per_trade_pct: form.risk_per_trade_pct,
      max_concurrent: form.max_concurrent,
      max_net_delta: posOrNull(form.max_net_delta),
      max_net_vega: posOrNull(form.max_net_vega),
    },
    exit: {
      max_hold_minutes: parsedHold != null && Number.isFinite(parsedHold) ? parsedHold : null,
      profit_target_pct: pctToFraction(form.profit_target_pct),
      stop_loss_pct: pctToFraction(form.stop_loss_pct),
    },
  };

  if (form.mode === 'strategy') {
    // Strategy REPLACES patterns — include `strategy`, omit `patterns`.
    const neutral = isNeutral(form.structure);
    const usesWidth = form.structure !== 'single';
    spec.strategy = {
      direction: neutral ? 'neutral' : form.direction,
      conditions: form.conditions
        .filter(isConditionComplete)
        .map((c) => conditionToSpec(c, meta)),
      entry: { dte: Number(form.dte) },
      structure: form.structure,
      width: usesWidth ? Number(form.width) || 5 : undefined,
      wing: form.structure === 'condor' ? Number(form.wing) || 5 : undefined,
      // Level offsets are directional only; neutral structures exit on the
      // premium overlay (set below in `exit`).
      target_offset_pct: neutral ? null : pctToFraction(form.target_offset_pct),
      stop_offset_pct: neutral ? null : pctToFraction(form.stop_offset_pct),
    };
  } else {
    spec.patterns = form.patterns;
  }

  return spec;
}

/** Fraction (0.5) → percent string ("50"); null/undefined → "" (off). */
function fractionToPctStr(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  return String(Number((value * 100).toFixed(6)));
}

/** Number → string; null/undefined → "" (off). */
function numOrBlankStr(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '' : String(value);
}

/**
 * Inverse of {@link formToSpec}: hydrate the form from a saved/shared spec.
 * Starts from the meta-derived defaults so any field the spec omits keeps a
 * sane value, then overlays everything the spec carries.
 */
function specToForm(spec: BacktestSpec, meta: BacktestMeta): FormState {
  const base = buildInitialForm(meta);
  const form: FormState = {
    ...base,
    underlying: meta.underlyings.includes(spec.underlying) ? spec.underlying : base.underlying,
    start_date: spec.start_date || base.start_date,
    end_date: spec.end_date || base.end_date,
    capital: spec.sizing.capital,
    risk_per_trade_pct: spec.sizing.risk_per_trade_pct,
    max_concurrent: spec.sizing.max_concurrent,
    slippage_pct: spec.fill_model.slippage_pct,
    commission_per_contract: spec.fill_model.commission_per_contract,
    max_net_delta: numOrBlankStr(spec.sizing.max_net_delta),
    max_net_vega: numOrBlankStr(spec.sizing.max_net_vega),
    max_hold_minutes: numOrBlankStr(spec.exit.max_hold_minutes),
    profit_target_pct: fractionToPctStr(spec.exit.profit_target_pct),
    stop_loss_pct: fractionToPctStr(spec.exit.stop_loss_pct),
  };

  if (spec.strategy) {
    const s = spec.strategy;
    form.mode = 'strategy';
    // The form's `direction` is bullish/bearish only; neutral structures keep a
    // harmless default since the direction control is hidden for them.
    form.direction = s.direction === 'bearish' ? 'bearish' : 'bullish';
    form.structure = s.structure ?? 'single';
    form.width = s.width != null ? String(s.width) : base.width;
    form.wing = s.wing != null ? String(s.wing) : base.wing;
    form.dte = String(s.entry?.dte ?? 0);
    form.target_offset_pct = fractionToPctStr(s.target_offset_pct);
    form.stop_offset_pct = fractionToPctStr(s.stop_offset_pct);
    form.conditions =
      s.conditions.length > 0
        ? s.conditions.map((c) => ({ field: c.field, op: c.op, value: String(c.value) }))
        : [blankCondition(meta)];
  } else {
    form.mode = 'patterns';
    form.patterns = spec.patterns ?? [];
  }

  return form;
}

// ---- Parameter sweep helpers ---------------------------------------------

/** An axis as edited in the form: a param + a free-text list of values. */
interface SweepAxisForm {
  param: string;
  valuesText: string;
}

/** Parse "10, 20 30" → [10, 20, 30], dropping anything non-numeric. */
function parseAxisValues(text: string): number[] {
  return text
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s !== '')
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

/**
 * Compile the form axes into the API payload. `as_fraction` params accept a
 * percent in the form and are divided by 100 (matching the single-run form),
 * and each axis's values are de-duplicated preserving order.
 */
function buildSweepAxes(axes: SweepAxisForm[], meta: BacktestMeta): BacktestSweepAxis[] {
  const params = meta.sweep_params ?? [];
  const out: BacktestSweepAxis[] = [];
  for (const a of axes) {
    if (!a.param) continue;
    const def = params.find((p) => p.param === a.param);
    let values = parseAxisValues(a.valuesText);
    if (def?.as_fraction) values = values.map((v) => v / 100);
    const uniq = values.filter((v, i) => values.indexOf(v) === i);
    if (uniq.length > 0) out.push({ param: a.param, values: uniq });
  }
  return out;
}

/** Total grid cells the axes would produce (0 when none are complete). */
function sweepCellCount(axes: BacktestSweepAxis[]): number {
  if (axes.length === 0) return 0;
  return axes.reduce((acc, a) => acc * a.values.length, 1);
}

// ---- Formatting helpers --------------------------------------------------

function fmtPct(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value >= 0 ? '' : ''}${value.toFixed(digits)}%`;
}

function fmtCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function fmtNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

function pnlColor(value: number): string {
  if (value > 0) return 'var(--color-bull)';
  if (value < 0) return 'var(--color-bear)';
  return 'var(--color-text-secondary)';
}

function formatDateTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// ---- Page ----------------------------------------------------------------

export default function BacktestingPage() {
  const bt = useBacktest();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <h1 className="text-3xl font-bold">Backtesting</h1>
        <BetaBadge size="md" />
        <TooltipWrapper text={TITLE_TOOLTIP} placement="bottom">
          <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
        </TooltipWrapper>
        <Link
          href="/backtesting/insights"
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-[var(--color-accent)]/15"
          style={{
            borderColor: 'var(--color-accent)',
            color: 'var(--color-accent)',
          }}
        >
          <TrendingUp size={14} />
          Pattern Insights
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] gap-8">
        <div className="flex flex-col gap-6">
          <ConfigPanel bt={bt} />
          <RecentRuns bt={bt} />
        </div>
        <div className="min-w-0">
          <Results bt={bt} />
        </div>
      </div>
    </div>
  );
}

// ---- Config panel --------------------------------------------------------

function ConfigPanel({ bt }: { bt: ReturnType<typeof useBacktest> }) {
  const { meta, metaState, metaError, running, submit, submitError, submitSweep, sweepRunning } = bt;
  const [form, setForm] = useState<FormState | null>(null);
  const [sweepAxes, setSweepAxes] = useState<SweepAxisForm[]>([]);

  // ---- Saved & shareable configs (Phase 6) ------------------------------
  const [savedConfigs, setSavedConfigs] = useState<BacktestConfigSummary[]>([]);
  const [saveName, setSaveName] = useState('');
  const [savingBusy, setSavingBusy] = useState(false);
  const [configNotice, setConfigNotice] = useState<string | null>(null);
  const sharedLoadedRef = useRef(false);

  const refreshConfigs = useCallback(() => {
    backtestAPI
      .listConfigs()
      .then(setSavedConfigs)
      .catch(() => {
        // Saved configs are best-effort; a fetch failure shouldn't surface.
      });
  }, []);

  useEffect(() => {
    refreshConfigs();
  }, [refreshConfigs]);

  // Load a `?config=<token>` shared link once, after meta is ready (specToForm
  // needs the catalog). Strips the param afterward so a refresh is clean.
  useEffect(() => {
    if (sharedLoadedRef.current || !meta) return;
    sharedLoadedRef.current = true;
    const token = new URLSearchParams(window.location.search).get('config');
    if (!token) return;
    backtestAPI
      .getSharedConfig(token)
      .then((cfg) => {
        setForm(specToForm(cfg.spec, meta));
        setConfigNotice(`Loaded shared config “${cfg.name}”.`);
      })
      .catch(() => setConfigNotice('Could not load that shared configuration.'))
      .finally(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete('config');
        window.history.replaceState({}, '', url.toString());
      });
  }, [meta]);

  // Seed the form the first render after meta resolves. Adjusting state
  // during render (guarded so it runs once) is React's recommended pattern
  // for deriving initial state from an async prop — no effect needed.
  if (meta && form == null) {
    setForm(buildInitialForm(meta));
  }

  if (metaState === 'loading' || (metaState === 'ready' && form == null)) {
    return (
      <section className="zg-feature-shell p-6">
        <Skeleton height={420} label="Loading configuration…" />
      </section>
    );
  }

  if (metaState === 'error' || !meta || !form) {
    return (
      <section className="zg-feature-shell p-6">
        <ErrorBox title="Couldn't load backtest options" message={metaError ?? 'Please try again.'} />
      </section>
    );
  }

  const patternsByTier = new Map<string, BacktestMeta['patterns']>();
  for (const p of meta.patterns) {
    const list = patternsByTier.get(p.tier) ?? [];
    list.push(p);
    patternsByTier.set(p.tier, list);
  }

  const togglePattern = (id: string) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            patterns: prev.patterns.includes(id)
              ? prev.patterns.filter((x) => x !== id)
              : [...prev.patterns, id],
          }
        : prev,
    );
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const numField = (key: keyof FormState, value: string) =>
    setForm((prev) => (prev ? { ...prev, [key]: value === '' ? 0 : Number(value) } : prev));

  // ---- Custom-strategy condition helpers --------------------------------
  const fieldDef = (id: string): BacktestStrategyField | undefined =>
    meta.strategy_fields.find((f) => f.field === id);

  const addCondition = () =>
    setForm((prev) =>
      prev ? { ...prev, conditions: [...prev.conditions, blankCondition(meta)] } : prev,
    );

  const removeCondition = (idx: number) =>
    setForm((prev) =>
      prev ? { ...prev, conditions: prev.conditions.filter((_, i) => i !== idx) } : prev,
    );

  const updateCondition = (idx: number, patch: Partial<FormCondition>) =>
    setForm((prev) => {
      if (!prev) return prev;
      const conditions = prev.conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c));
      return { ...prev, conditions };
    });

  // Changing the field resets the op (to the new field's first op) and value,
  // since both are field-specific.
  const changeConditionField = (idx: number, field: string) => {
    const def = fieldDef(field);
    updateCondition(idx, { field, op: def?.ops[0] ?? '', value: '' });
  };

  // ---- Submit gating ----------------------------------------------------
  const hasPremiumExit =
    pctToFraction(form.profit_target_pct) != null || pctToFraction(form.stop_loss_pct) != null;
  const hasLevelExit =
    pctToFraction(form.target_offset_pct) != null || pctToFraction(form.stop_offset_pct) != null;
  const validConditions = form.conditions.filter(isConditionComplete);
  const neutralStructure = isNeutral(form.structure);

  const strategyMissing =
    validConditions.length === 0
      ? 'Add at least one condition to run a custom strategy.'
      : neutralStructure && !hasPremiumExit
        ? 'This structure is non-directional — set a premium take-profit or stop-loss.'
        : !neutralStructure && !hasLevelExit && !hasPremiumExit
          ? 'Set an exit: a target/stop offset, or a premium take-profit/stop-loss.'
          : null;

  const canSubmit =
    form.underlying !== '' &&
    !running &&
    (form.mode === 'patterns' ? form.patterns.length > 0 : strategyMissing == null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    void submit(formToSpec(form, meta));
  };

  // ---- Saved-config actions ---------------------------------------------
  // A config is savable when it would produce a valid, runnable spec.
  const configValid =
    form.underlying !== '' &&
    (form.mode === 'patterns' ? form.patterns.length > 0 : strategyMissing == null);

  const onSaveConfig = async () => {
    const name = saveName.trim();
    if (!name || !configValid || savingBusy) return;
    setSavingBusy(true);
    setConfigNotice(null);
    try {
      await backtestAPI.saveConfig(name, formToSpec(form, meta));
      setSaveName('');
      setConfigNotice(`Saved “${name}”.`);
      refreshConfigs();
    } catch (err) {
      setConfigNotice(err instanceof Error ? err.message : 'Could not save configuration.');
    } finally {
      setSavingBusy(false);
    }
  };

  const onLoadConfig = async (id: number) => {
    setConfigNotice(null);
    try {
      const cfg = await backtestAPI.getConfig(id);
      setForm(specToForm(cfg.spec, meta));
      setConfigNotice(`Loaded “${cfg.name}”.`);
    } catch {
      setConfigNotice('Could not load that configuration.');
    }
  };

  const onDeleteConfig = async (id: number) => {
    try {
      await backtestAPI.deleteConfig(id);
      refreshConfigs();
    } catch {
      setConfigNotice('Could not delete that configuration.');
    }
  };

  const onShareConfig = async (cfg: BacktestConfigSummary) => {
    if (!cfg.share_token) return;
    const link = `${window.location.origin}/backtesting?config=${cfg.share_token}`;
    try {
      await navigator.clipboard.writeText(link);
      setConfigNotice('Share link copied to clipboard.');
    } catch {
      setConfigNotice(link);
    }
  };

  const onLoadFeatured = (s: FeaturedStrategy) => {
    setForm(featuredToForm(s, meta));
    setConfigNotice(`Loaded “${s.name}”. Review the date range, then run.`);
  };

  // ---- Parameter-sweep gating + actions ---------------------------------
  // Strategy-scoped params only apply to a custom-strategy base spec.
  const sweepParamsForMode = (meta.sweep_params ?? []).filter(
    (p) => p.scope === 'any' || form.mode === 'strategy',
  );
  const builtAxes = buildSweepAxes(sweepAxes, meta);
  const sweepCells = sweepCellCount(builtAxes);
  const canSweep =
    configValid &&
    builtAxes.length > 0 &&
    sweepCells > 0 &&
    sweepCells <= SWEEP_MAX_CELLS &&
    !running &&
    !sweepRunning;

  const onRunSweep = () => {
    if (!canSweep) return;
    void submitSweep(formToSpec(form, meta), builtAxes);
  };

  return (
    <section className="zg-feature-shell p-6">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <SlidersHorizontal size={20} />
        Configuration
      </h2>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Underlying">
          <select
            className="w-full rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
            value={form.underlying}
            onChange={(e) => setField('underlying', e.target.value)}
          >
            {meta.underlyings.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <input
              type="date"
              className="w-full rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
              value={form.start_date}
              min={meta.data_window.earliest}
              max={meta.data_window.latest}
              onChange={(e) => setField('start_date', e.target.value)}
            />
          </Field>
          <Field label="End date">
            <input
              type="date"
              className="w-full rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
              value={form.end_date}
              min={meta.data_window.earliest}
              max={meta.data_window.latest}
              onChange={(e) => setField('end_date', e.target.value)}
            />
          </Field>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-secondary)] mb-2">
            Signal source
          </div>
          <div
            className="grid grid-cols-2 gap-1 rounded-lg border p-1"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-subtle)' }}
            role="tablist"
          >
            {(
              [
                ['patterns', 'Playbook patterns'],
                ['strategy', 'Custom strategy'],
              ] as const
            ).map(([value, label]) => {
              const active = form.mode === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setField('mode', value)}
                  className="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{
                    background: active ? 'var(--color-surface-elevated)' : 'transparent',
                    color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    border: active ? '1px solid var(--color-border)' : '1px solid transparent',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {form.mode === 'patterns' ? (
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-secondary)] mb-2">
              Patterns
            </div>
            <div className="flex flex-col gap-3">
              {[...patternsByTier.entries()].map(([tier, list]) => (
                <fieldset key={tier} className="rounded-lg border p-3" style={{ borderColor: 'var(--color-border)' }}>
                  <legend className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
                    {tier}
                  </legend>
                  <div className="flex flex-col gap-2">
                    {list.map((p) => (
                      <label key={p.id} className="flex items-start gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={form.patterns.includes(p.id)}
                          onChange={() => togglePattern(p.id)}
                        />
                        <span className="flex-1">
                          <span className="font-medium">{p.name}</span>
                          {p.description ? (
                            <span className="block text-[11px] text-[var(--color-text-secondary)] leading-snug">
                              {p.description}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {neutralStructure ? (
              <p className="text-[11px] text-[var(--color-text-secondary)]">
                Non-directional structure — exits use the premium take-profit / stop-loss below.
              </p>
            ) : (
              <Field label="Direction">
                <select
                  className="w-full rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
                  value={form.direction}
                  onChange={(e) => setField('direction', e.target.value as 'bullish' | 'bearish')}
                >
                  <option value="bullish">Bullish</option>
                  <option value="bearish">Bearish</option>
                </select>
              </Field>
            )}

            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-secondary)] mb-2">
                Conditions
              </div>
              <div className="flex flex-col gap-2">
                {form.conditions.map((c, idx) => {
                  const def = fieldDef(c.field);
                  return (
                    <div
                      key={idx}
                      className="rounded-lg border p-2.5 flex flex-col gap-2"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <div className="flex items-center gap-2">
                        <select
                          aria-label="Field"
                          className="flex-1 min-w-0 rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2 py-1.5 text-sm"
                          value={c.field}
                          onChange={(e) => changeConditionField(idx, e.target.value)}
                        >
                          {meta.strategy_fields.map((f) => (
                            <option key={f.field} value={f.field}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          aria-label="Remove condition"
                          onClick={() => removeCondition(idx)}
                          disabled={form.conditions.length === 1}
                          className="shrink-0 rounded-md border px-2 py-1.5 text-sm leading-none disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ borderColor: 'var(--color-border)' }}
                        >
                          ×
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          aria-label="Operator"
                          className="shrink-0 rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2 py-1.5 text-sm font-mono"
                          value={c.op}
                          onChange={(e) => updateCondition(idx, { op: e.target.value })}
                        >
                          {(def?.ops ?? []).map((op) => (
                            <option key={op} value={op}>
                              {op}
                            </option>
                          ))}
                        </select>
                        {def?.type === 'categorical' ? (
                          <select
                            aria-label="Value"
                            className="flex-1 min-w-0 rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2 py-1.5 text-sm"
                            value={c.value}
                            onChange={(e) => updateCondition(idx, { value: e.target.value })}
                          >
                            <option value="">Select…</option>
                            {(def.values ?? []).map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="relative flex-1 min-w-0">
                            <input
                              aria-label="Value"
                              type="number"
                              className="w-full rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2 py-1.5 text-sm pr-7"
                              value={c.value}
                              placeholder="Value"
                              onChange={(e) => updateCondition(idx, { value: e.target.value })}
                            />
                            {def?.unit ? (
                              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-secondary)]">
                                {def.unit}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={addCondition}
                className="mt-2 rounded-md border px-2.5 py-1 text-xs font-semibold"
                style={{ borderColor: 'var(--color-border)' }}
              >
                + Add condition
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Structure">
                <select
                  className="w-full rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
                  value={form.structure}
                  onChange={(e) =>
                    setField('structure', e.target.value as FormState['structure'])
                  }
                >
                  {(meta.strategy_structures ?? [
                    { id: 'single', label: 'Single option (ATM)' },
                    { id: 'vertical', label: 'Vertical spread (defined risk)' },
                  ]).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
              {form.structure !== 'single' ? (
                <Field
                  label={
                    form.structure === 'strangle' || form.structure === 'condor'
                      ? 'Strike offset (pts)'
                      : 'Spread width (pts)'
                  }
                >
                  <input
                    type="number"
                    className="w-full rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
                    value={form.width}
                    min={1}
                    step={1}
                    onChange={(e) => setField('width', e.target.value)}
                  />
                </Field>
              ) : (
                <div />
              )}
              {form.structure === 'condor' ? (
                <Field label="Wing width (pts)">
                  <input
                    type="number"
                    className="w-full rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
                    value={form.wing}
                    min={1}
                    step={1}
                    onChange={(e) => setField('wing', e.target.value)}
                  />
                </Field>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="DTE">
                <input
                  type="number"
                  className="w-full rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
                  value={form.dte}
                  min={0}
                  step={1}
                  onChange={(e) => setField('dte', e.target.value)}
                />
              </Field>
              {!neutralStructure ? (
                <>
                  <Field label="Target offset (%)">
                    <input
                      type="number"
                      className="w-full rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
                      value={form.target_offset_pct}
                      min={0}
                      step={0.1}
                      placeholder="Off"
                      onChange={(e) => setField('target_offset_pct', e.target.value)}
                    />
                  </Field>
                  <Field label="Stop offset (%)">
                    <input
                      type="number"
                      className="w-full rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
                      value={form.stop_offset_pct}
                      min={0}
                      step={0.1}
                      placeholder="Off"
                      onChange={(e) => setField('stop_offset_pct', e.target.value)}
                    />
                  </Field>
                </>
              ) : null}
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] leading-snug">
              {neutralStructure ? (
                <>
                  This structure exits on the premium <span className="font-medium">Take profit</span> /{' '}
                  <span className="font-medium">Stop loss</span> inputs below (and the time stop).
                </>
              ) : (
                <>
                  Target/stop offsets are moves in the{' '}
                  <span className="font-medium">underlying price</span> from entry (favorable /
                  adverse). The premium <span className="font-medium">Take profit</span> /{' '}
                  <span className="font-medium">Stop loss</span> inputs below also apply to the
                  option.
                </>
              )}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Capital ($)">
            <input
              type="number"
              className="w-full rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
              value={form.capital}
              min={0}
              step={1000}
              onChange={(e) => numField('capital', e.target.value)}
            />
          </Field>
          <Field label="Risk / trade (%)">
            <input
              type="number"
              className="w-full rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
              value={form.risk_per_trade_pct}
              min={0}
              step={0.1}
              onChange={(e) => numField('risk_per_trade_pct', e.target.value)}
            />
          </Field>
          <Field label="Slippage (%)">
            <input
              type="number"
              className="w-full rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
              value={form.slippage_pct}
              min={0}
              step={0.01}
              onChange={(e) => numField('slippage_pct', e.target.value)}
            />
          </Field>
          <Field label="Commission / contract ($)">
            <input
              type="number"
              className="w-full rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
              value={form.commission_per_contract}
              min={0}
              step={0.05}
              onChange={(e) => numField('commission_per_contract', e.target.value)}
            />
          </Field>
          <Field label="Max concurrent">
            <input
              type="number"
              className="w-full rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
              value={form.max_concurrent}
              min={1}
              step={1}
              onChange={(e) => numField('max_concurrent', e.target.value)}
            />
          </Field>
          <Field label="Max net Δ">
            <input
              type="number"
              className="w-full rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
              value={form.max_net_delta}
              min={0}
              step={10}
              placeholder="Off"
              onChange={(e) => setField('max_net_delta', e.target.value)}
            />
          </Field>
          <Field label="Max net vega">
            <input
              type="number"
              className="w-full rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
              value={form.max_net_vega}
              min={0}
              step={5}
              placeholder="Off"
              onChange={(e) => setField('max_net_vega', e.target.value)}
            />
          </Field>
          <Field label="Max hold (min)">
            <input
              type="number"
              className="w-full rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
              value={form.max_hold_minutes}
              min={0}
              step={1}
              placeholder="None"
              onChange={(e) => setField('max_hold_minutes', e.target.value)}
            />
          </Field>
          <Field label="Take profit (%)">
            <input
              type="number"
              className="w-full rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
              value={form.profit_target_pct}
              min={0}
              step={5}
              placeholder="Off"
              onChange={(e) => setField('profit_target_pct', e.target.value)}
            />
          </Field>
          <Field label="Stop loss (%)">
            <input
              type="number"
              className="w-full rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
              value={form.stop_loss_pct}
              min={0}
              max={100}
              step={5}
              placeholder="Off"
              onChange={(e) => setField('stop_loss_pct', e.target.value)}
            />
          </Field>
        </div>

        {form.mode === 'patterns' && form.patterns.length === 0 ? (
          <p className="text-[11px] text-[var(--color-text-secondary)]">
            Select at least one pattern to run a backtest.
          </p>
        ) : null}

        {form.mode === 'strategy' && strategyMissing ? (
          <p className="text-[11px] text-[var(--color-text-secondary)]">{strategyMissing}</p>
        ) : null}

        {submitError ? <ErrorBox title="Run failed to start" message={submitError} /> : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-elevated)' }}
        >
          <Play size={16} />
          {running ? 'Running…' : 'Run Backtest'}
        </button>

        <SweepEditor
          params={sweepParamsForMode}
          axes={sweepAxes}
          onAxesChange={setSweepAxes}
          cells={sweepCells}
          canSweep={canSweep}
          busy={sweepRunning}
          onRunSweep={onRunSweep}
        />
      </form>

      <FeaturedStrategies onLoad={onLoadFeatured} />

      <SavedConfigs
        configs={savedConfigs}
        saveName={saveName}
        onSaveNameChange={setSaveName}
        onSave={onSaveConfig}
        onLoad={onLoadConfig}
        onDelete={onDeleteConfig}
        onShare={onShareConfig}
        canSave={configValid && saveName.trim() !== '' && !savingBusy}
        busy={savingBusy}
        notice={configNotice}
      />
    </section>
  );
}

// ---- Featured strategies UI ---------------------------------------------

function FeaturedStrategies({ onLoad }: { onLoad: (s: FeaturedStrategy) => void }) {
  if (FEATURED_STRATEGIES.length === 0) return null;
  return (
    <div className="mt-6 pt-5 border-t" style={{ borderColor: 'var(--color-border)' }}>
      <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-secondary)] mb-2">
        Featured strategies
      </div>
      <ul className="flex flex-col gap-2">
        {FEATURED_STRATEGIES.map((s) => (
          <li
            key={s.id}
            className="rounded-lg border px-3 py-2.5"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <button
              type="button"
              onClick={() => onLoad(s)}
              className="block w-full text-left"
              title="Load this strategy into the form"
            >
              <span className="block text-sm font-semibold">{s.name}</span>
              <span className="block mt-0.5 text-[11px] text-[var(--color-text-secondary)]">
                {s.blurb}
              </span>
              <span className="block mt-1 text-[11px] leading-snug text-[var(--color-text-secondary)]">
                {s.evidence}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- Saved configs -------------------------------------------------------

function SavedConfigs({
  configs,
  saveName,
  onSaveNameChange,
  onSave,
  onLoad,
  onDelete,
  onShare,
  canSave,
  busy,
  notice,
}: {
  configs: BacktestConfigSummary[];
  saveName: string;
  onSaveNameChange: (v: string) => void;
  onSave: () => void;
  onLoad: (id: number) => void;
  onDelete: (id: number) => void;
  onShare: (cfg: BacktestConfigSummary) => void;
  canSave: boolean;
  busy: boolean;
  notice: string | null;
}) {
  return (
    <div className="mt-6 pt-5 border-t" style={{ borderColor: 'var(--color-border)' }}>
      <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-secondary)] mb-2">
        Saved configurations
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={saveName}
          placeholder="Name this configuration…"
          maxLength={120}
          onChange={(e) => onSaveNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (canSave) onSave();
            }
          }}
          className="flex-1 min-w-0 rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <Save size={15} />
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>

      {notice ? (
        <p className="mt-2 text-[11px] text-[var(--color-text-secondary)] break-words">{notice}</p>
      ) : null}

      {configs.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1.5">
          {configs.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-2 rounded-lg border px-3 py-2"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <button
                type="button"
                onClick={() => onLoad(c.id)}
                className="flex-1 min-w-0 text-left"
                title="Load this configuration"
              >
                <span className="block truncate text-sm font-medium">{c.name}</span>
                <span className="block text-[11px] text-[var(--color-text-secondary)]">
                  {c.underlying}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onShare(c)}
                disabled={!c.share_token}
                aria-label={`Copy share link for ${c.name}`}
                title="Copy share link"
                className="shrink-0 rounded-md border p-1.5 disabled:opacity-40"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <Share2 size={14} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(c.id)}
                aria-label={`Delete ${c.name}`}
                title="Delete"
                className="shrink-0 rounded-md border p-1.5"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[11px] text-[var(--color-text-secondary)]">
          No saved configurations yet. Name the current setup and press Save.
        </p>
      )}
    </div>
  );
}

// ---- Parameter sweep editor ----------------------------------------------

function SweepEditor({
  params,
  axes,
  onAxesChange,
  cells,
  canSweep,
  busy,
  onRunSweep,
}: {
  params: BacktestSweepParam[];
  axes: SweepAxisForm[];
  onAxesChange: (axes: SweepAxisForm[]) => void;
  cells: number;
  canSweep: boolean;
  busy: boolean;
  onRunSweep: () => void;
}) {
  if (params.length === 0) return null;

  const usedParams = new Set(axes.map((a) => a.param));
  const firstFree = params.find((p) => !usedParams.has(p.param))?.param ?? params[0].param;

  const addAxis = () => onAxesChange([...axes, { param: firstFree, valuesText: '' }]);
  const removeAxis = (idx: number) => onAxesChange(axes.filter((_, i) => i !== idx));
  const updateAxis = (idx: number, patch: Partial<SweepAxisForm>) =>
    onAxesChange(axes.map((a, i) => (i === idx ? { ...a, ...patch } : a)));

  const overLimit = cells > SWEEP_MAX_CELLS;

  return (
    <div className="mt-2 pt-5 border-t" style={{ borderColor: 'var(--color-border)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
          Parameter sweep
        </span>
        {axes.length < 2 ? (
          <button
            type="button"
            onClick={addAxis}
            className="rounded-md border px-2 py-1 text-[11px] font-semibold"
            style={{ borderColor: 'var(--color-border)' }}
          >
            + Add axis
          </button>
        ) : null}
      </div>

      {axes.length === 0 ? (
        <p className="text-[11px] text-[var(--color-text-secondary)]">
          Optional — vary one or two parameters across a grid and compare the results.
          Add an axis to begin.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {axes.map((a, idx) => {
            const def = params.find((p) => p.param === a.param);
            const count = parseAxisValues(a.valuesText).filter(
              (v, i, arr) => arr.indexOf(v) === i,
            ).length;
            return (
              <div
                key={idx}
                className="rounded-lg border p-2.5 flex flex-col gap-2"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Sweep parameter"
                    className="flex-1 min-w-0 rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2 py-1.5 text-sm"
                    value={a.param}
                    onChange={(e) => updateAxis(idx, { param: e.target.value })}
                  >
                    {params.map((p) => (
                      <option
                        key={p.param}
                        value={p.param}
                        disabled={usedParams.has(p.param) && p.param !== a.param}
                      >
                        {p.label}
                        {p.unit ? ` (${p.unit})` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-label="Remove axis"
                    onClick={() => removeAxis(idx)}
                    className="shrink-0 rounded-md border px-2 py-1.5 text-sm leading-none"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    ×
                  </button>
                </div>
                <input
                  aria-label="Axis values"
                  type="text"
                  value={a.valuesText}
                  placeholder={def?.unit === '%' ? 'e.g. 25, 50, 75' : 'e.g. 1, 2, 3'}
                  onChange={(e) => updateAxis(idx, { valuesText: e.target.value })}
                  className="w-full rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
                />
                <span className="text-[10px] text-[var(--color-text-secondary)]">
                  Comma-separated values{def?.unit ? ` in ${def.unit === '%' ? 'percent' : def.unit}` : ''}.
                  {count > 0 ? ` ${count} value${count === 1 ? '' : 's'}.` : ''}
                </span>
              </div>
            );
          })}

          <p
            className="text-[11px]"
            style={{ color: overLimit ? 'var(--color-bear)' : 'var(--color-text-secondary)' }}
          >
            {cells > 0
              ? overLimit
                ? `${cells} cells exceeds the ${SWEEP_MAX_CELLS}-cell limit — trim a value list.`
                : `${cells} cell${cells === 1 ? '' : 's'} — ${cells} full backtest${cells === 1 ? '' : 's'} will run.`
              : 'Enter values for each axis to build the grid.'}
          </p>

          <button
            type="button"
            onClick={onRunSweep}
            disabled={!canSweep}
            className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-elevated)' }}
          >
            <LayoutGrid size={16} />
            {busy ? 'Sweeping…' : 'Run Sweep'}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">{label}</span>
      {children}
    </label>
  );
}

// ---- Recent runs ---------------------------------------------------------

function RecentRuns({ bt }: { bt: ReturnType<typeof useBacktest> }) {
  const { recentRuns, openRun, run } = bt;
  return (
    <section className="zg-feature-shell p-6">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <History size={18} />
        Recent Runs
      </h2>
      {recentRuns.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">No runs yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {recentRuns.map((r) => {
            const active = run?.run_id === r.run_id;
            return (
              <li key={r.run_id}>
                <button
                  type="button"
                  onClick={() => openRun(r.run_id)}
                  className="w-full text-left rounded-lg border px-3 py-2 text-xs transition-colors"
                  style={{
                    borderColor: active ? 'var(--color-accent, var(--color-text-primary))' : 'var(--color-border)',
                    background: active ? 'var(--color-surface-elevated)' : 'transparent',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">
                      #{r.run_id} · {r.underlying}
                    </span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="mt-0.5 text-[var(--color-text-secondary)]">
                    {r.start_date} → {r.end_date}
                  </div>
                  {r.summary ? (
                    <div className="mt-1 flex items-center gap-3 font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ color: pnlColor(r.summary.net_pnl) }}>{fmtCurrency(r.summary.net_pnl)}</span>
                      <span className="text-[var(--color-text-secondary)]">{r.summary.n_trades} trades</span>
                    </div>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  let color = 'var(--color-text-secondary)';
  if (status === 'completed') color = 'var(--color-bull)';
  else if (status === 'failed') color = 'var(--color-bear)';
  else if (status === 'running' || status === 'queued') color = 'var(--color-warning)';
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color }}>
      {status}
    </span>
  );
}

// ---- Results -------------------------------------------------------------

function Results({ bt }: { bt: ReturnType<typeof useBacktest> }) {
  const { run, running, equity, trades, tradesPage, tradesLoading, setTradesPage } = bt;

  // Parameter-sweep view takes over the results pane while active.
  if (bt.view === 'sweep') {
    return <SweepResults sweep={bt.sweep} running={bt.sweepRunning} meta={bt.meta} />;
  }

  // Empty state: nothing run yet.
  if (!run && !running) {
    return (
      <section className="zg-feature-shell p-6">
        <EmptyState />
      </section>
    );
  }

  // In-progress: show a progress bar driven by `progress`, or a surfaced poll
  // error if we stopped waiting (stuck run / lost connection).
  if (run && (run.status === 'queued' || run.status === 'running')) {
    return (
      <section className="zg-feature-shell p-6">
        {bt.pollError ? (
          <ErrorBox title="Run status unavailable" message={bt.pollError} />
        ) : (
          <ProgressView status={run.status} progress={run.progress} runId={run.run_id} />
        )}
      </section>
    );
  }

  if (running && !run) {
    return (
      <section className="zg-feature-shell p-6">
        <ProgressView status="queued" progress={0} runId={null} />
      </section>
    );
  }

  if (run && run.status === 'failed') {
    return (
      <section className="zg-feature-shell p-6">
        <ErrorBox
          title={`Run #${run.run_id} failed`}
          message={run.error ?? 'The backtest engine reported a failure with no detail.'}
        />
      </section>
    );
  }

  // Completed.
  if (run && run.status === 'completed') {
    const summary = run.summary;
    return (
      <div className="flex flex-col gap-8">
        {summary ? <StatsCards summary={summary} /> : null}

        {summary ? <TearsheetPanel summary={summary} /> : null}

        {summary?.diagnostics ? (
          <DiagnosticsPanel diagnostics={summary.diagnostics} nTrades={summary.n_trades} />
        ) : null}

        <section className="zg-feature-shell p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <LineChartIcon size={20} />
            Equity Curve
          </h2>
          <EquityChart equity={equity} startingCapital={run.spec.sizing.capital} />
        </section>

        {summary ? (
          <MonteCarloPanel summary={summary} capital={run.spec.sizing.capital} />
        ) : null}

        {summary ? <RegimeBreakdown summary={summary} /> : null}

        {summary && summary.by_pattern.length > 0 ? <ByPatternTable summary={summary} /> : null}

        <section className="zg-feature-shell p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <ListOrdered size={20} />
              Trade Blotter
            </h2>
            {summary && summary.n_trades > 0 ? (
              <a
                href={`/api/backtest/runs/${run.run_id}/trades.csv`}
                download
                className="inline-flex items-center gap-1.5 text-sm rounded-md border border-[var(--color-border)] px-3 py-1.5 hover:bg-[var(--color-surface-subtle)]"
              >
                <Download size={15} />
                Export CSV
              </a>
            ) : null}
          </div>
          <TradesBlotter
            page={trades}
            pageIndex={tradesPage}
            loading={tradesLoading}
            onPage={setTradesPage}
          />
        </section>
      </div>
    );
  }

  return null;
}

// ---- Sweep results -------------------------------------------------------

type SweepMetricKey = 'net_pnl' | 'win_rate' | 'total_return_pct' | 'profit_factor';

const SWEEP_METRICS: { key: SweepMetricKey; label: string; fmt: (v: number) => string }[] = [
  { key: 'net_pnl', label: 'Net P&L', fmt: (v) => fmtCurrency(v) },
  { key: 'win_rate', label: 'Win rate', fmt: (v) => fmtPct(v) },
  { key: 'total_return_pct', label: 'Return', fmt: (v) => fmtPct(v) },
  { key: 'profit_factor', label: 'Profit factor', fmt: (v) => fmtNumber(v) },
];

/** Display an axis value in the units the user entered (percent for fractions). */
function fmtAxisValue(param: string, value: number, meta: BacktestMeta | null): string {
  const def = (meta?.sweep_params ?? []).find((p) => p.param === param);
  if (def?.as_fraction) return `${Number((value * 100).toFixed(6))}%`;
  if (def?.unit === '%') return `${value}%`;
  if (def?.unit && def.unit !== '') return `${value}`;
  return String(value);
}

function axisLabel(param: string, meta: BacktestMeta | null): string {
  return (meta?.sweep_params ?? []).find((p) => p.param === param)?.label ?? param;
}

/** Blend red→amber→green for t in [0,1]; higher is always "better" here. */
function heatColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  // red (220,38,38) → amber (217,164,6) → green (22,163,74)
  const stops =
    clamped < 0.5
      ? mix([220, 38, 38], [217, 164, 6], clamped / 0.5)
      : mix([217, 164, 6], [22, 163, 74], (clamped - 0.5) / 0.5);
  return `rgba(${stops[0]}, ${stops[1]}, ${stops[2]}, 0.28)`;
}

function mix(a: number[], b: number[], t: number): number[] {
  return a.map((av, i) => Math.round(av + (b[i] - av) * t));
}

function SweepResults({
  sweep,
  running,
  meta,
}: {
  sweep: BacktestSweep | null;
  running: boolean;
  meta: BacktestMeta | null;
}) {
  const [metric, setMetric] = useState<SweepMetricKey>('net_pnl');

  if (!sweep) {
    return (
      <section className="zg-feature-shell p-6">
        <ProgressView status="queued" progress={0} runId={null} />
      </section>
    );
  }

  const metricDef = SWEEP_METRICS.find((m) => m.key === metric)!;
  const axis0 = sweep.axes[0];
  const axis1 = sweep.axes[1];

  // Cell lookup keyed by the axis values each grid cell carries.
  const cellAt = (v0: number, v1?: number) =>
    sweep.cells.find((c) => {
      if (c.cell[axis0.param] !== v0) return false;
      if (axis1) return c.cell[axis1.param] === v1;
      return true;
    });

  const metricValue = (cell: ReturnType<typeof cellAt>): number | null => {
    const m = cell?.metrics;
    if (!m) return null;
    const v = m[metric];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };

  // Min/max of the selected metric across completed cells, for the heat scale.
  const completedValues = sweep.cells
    .map((c) => (c.metrics ? c.metrics[metric] : null))
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const lo = completedValues.length ? Math.min(...completedValues) : 0;
  const hi = completedValues.length ? Math.max(...completedValues) : 0;
  const norm = (v: number) => (hi > lo ? (v - lo) / (hi - lo) : 0.5);

  const pct = sweep.n_cells > 0 ? Math.round((sweep.completed / sweep.n_cells) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <section className="zg-feature-shell p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <LayoutGrid size={20} />
            Parameter Sweep #{sweep.sweep_id}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
              Metric
            </span>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as SweepMetricKey)}
              className="rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
            >
              {SWEEP_METRICS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between mb-2 text-xs">
          <span className="text-[var(--color-text-secondary)]">
            {sweep.underlying} · {sweep.completed}/{sweep.n_cells} cells complete
          </span>
          <StatusBadge status={running ? 'running' : 'completed'} />
        </div>
        <div className="h-2 w-full rounded-full overflow-hidden mb-5" style={{ background: 'var(--color-surface-subtle)' }}>
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${pct}%`, background: 'var(--color-bull)' }}
          />
        </div>

        {axis1 ? (
          <SweepMatrix
            axis0={axis0}
            axis1={axis1}
            meta={meta}
            cellAt={cellAt}
            metricValue={metricValue}
            fmt={metricDef.fmt}
            norm={norm}
          />
        ) : (
          <SweepTable
            axis0={axis0}
            meta={meta}
            cellAt={cellAt}
            metricKey={metric}
            metricValue={metricValue}
            norm={norm}
          />
        )}
      </section>
    </div>
  );
}

type CellAt = (v0: number, v1?: number) => BacktestSweep['cells'][number] | undefined;

function SweepMatrix({
  axis0,
  axis1,
  meta,
  cellAt,
  metricValue,
  fmt,
  norm,
}: {
  axis0: BacktestSweepAxis;
  axis1: BacktestSweepAxis;
  meta: BacktestMeta | null;
  cellAt: CellAt;
  metricValue: (cell: ReturnType<CellAt>) => number | null;
  fmt: (v: number) => string;
  norm: (v: number) => number;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="text-[11px] text-[var(--color-text-secondary)] mb-2">
        Rows: <span className="font-medium">{axisLabel(axis0.param, meta)}</span> · Columns:{' '}
        <span className="font-medium">{axisLabel(axis1.param, meta)}</span>
      </div>
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="p-2" />
            {axis1.values.map((v1) => (
              <th key={v1} className="p-2 font-semibold text-center whitespace-nowrap">
                {fmtAxisValue(axis1.param, v1, meta)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
          {axis0.values.map((v0) => (
            <tr key={v0}>
              <th className="p-2 font-semibold text-right whitespace-nowrap">
                {fmtAxisValue(axis0.param, v0, meta)}
              </th>
              {axis1.values.map((v1) => {
                const cell = cellAt(v0, v1);
                const val = metricValue(cell);
                const pending = !cell || cell.status !== 'completed';
                return (
                  <td
                    key={v1}
                    className="p-2 text-center font-mono"
                    title={
                      cell?.metrics
                        ? `${cell.metrics.n_trades} trades · win ${fmtPct(cell.metrics.win_rate)} · ${fmtCurrency(cell.metrics.net_pnl)}`
                        : cell?.status ?? 'pending'
                    }
                    style={{
                      background: val != null ? heatColor(norm(val)) : 'var(--color-surface-subtle)',
                      minWidth: 74,
                    }}
                  >
                    {pending ? (
                      <span className="text-[var(--color-text-secondary)]">
                        {cell?.status === 'failed' ? '×' : '…'}
                      </span>
                    ) : val != null ? (
                      fmt(val)
                    ) : (
                      '—'
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SweepTable({
  axis0,
  meta,
  cellAt,
  metricKey,
  metricValue,
  norm,
}: {
  axis0: BacktestSweepAxis;
  meta: BacktestMeta | null;
  cellAt: CellAt;
  metricKey: SweepMetricKey;
  metricValue: (cell: ReturnType<CellAt>) => number | null;
  norm: (v: number) => number;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="text-[11px] text-[var(--color-text-secondary)] mb-2">
        Axis: <span className="font-medium">{axisLabel(axis0.param, meta)}</span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[var(--color-text-secondary)] uppercase tracking-[0.1em]">
            <th className="py-2 pr-3 font-semibold">Value</th>
            <th className="py-2 pr-3 font-semibold text-right">Trades</th>
            <th className="py-2 pr-3 font-semibold text-right">Win rate</th>
            <th className="py-2 pr-3 font-semibold text-right">Net P&L</th>
            <th className="py-2 pr-3 font-semibold text-right">Return</th>
            <th className="py-2 pr-3 font-semibold text-right">Max DD</th>
            <th className="py-2 font-semibold text-right">Profit factor</th>
          </tr>
        </thead>
        <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
          {axis0.values.map((v0) => {
            const cell = cellAt(v0);
            const m = cell?.metrics;
            const sel = metricValue(cell);
            return (
              <tr key={v0} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                <th className="py-1.5 pr-3 text-left font-mono font-semibold whitespace-nowrap">
                  {fmtAxisValue(axis0.param, v0, meta)}
                </th>
                {!cell || cell.status !== 'completed' ? (
                  <td colSpan={6} className="py-1.5 text-[var(--color-text-secondary)]">
                    {cell?.status === 'failed' ? 'failed' : 'running…'}
                  </td>
                ) : (
                  <>
                    <td className="py-1.5 pr-3 text-right font-mono">{m?.n_trades ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{fmtPct(m?.win_rate)}</td>
                    <td
                      className="py-1.5 pr-3 text-right font-mono"
                      style={{
                        background:
                          metricKey === 'net_pnl' && sel != null ? heatColor(norm(sel)) : undefined,
                        color: m ? pnlColor(m.net_pnl) : undefined,
                      }}
                    >
                      {fmtCurrency(m?.net_pnl)}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono" style={{ color: m ? pnlColor(m.total_return_pct) : undefined }}>
                      {fmtPct(m?.total_return_pct)}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono" style={{ color: 'var(--color-bear)' }}>
                      {fmtPct(m?.max_drawdown_pct)}
                    </td>
                    <td
                      className="py-1.5 text-right font-mono"
                      style={{
                        background:
                          metricKey === 'profit_factor' && sel != null ? heatColor(norm(sel)) : undefined,
                      }}
                    >
                      {fmtNumber(m?.profit_factor)}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProgressView({
  status,
  progress,
  runId,
}: {
  status: string;
  progress: number;
  runId: number | null;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
  return (
    <div className="py-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold">
          {runId != null ? `Running backtest #${runId}` : 'Starting backtest…'}
        </span>
        <StatusBadge status={status} />
      </div>
      <div className="h-2.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--color-surface-subtle)' }}>
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%`, background: 'var(--color-bull)' }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <div className="mt-2 text-xs font-mono text-[var(--color-text-secondary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {pct}%
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="rounded-xl border p-12 text-center"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-subtle)' }}
    >
      <div className="text-lg font-semibold mb-1">No backtest run yet</div>
      <div className="text-sm text-[var(--color-text-secondary)]">
        Configure a run on the left and press <span className="font-semibold">Run Backtest</span>, or re-open a
        recent run.
      </div>
    </div>
  );
}

function StatsCards({ summary }: { summary: BacktestSummary }) {
  const cards: { label: string; value: string; color?: string }[] = [
    { label: 'Win rate', value: fmtPct(summary.win_rate) },
    { label: 'Net P&L', value: fmtCurrency(summary.net_pnl), color: pnlColor(summary.net_pnl) },
    {
      label: 'Total return',
      value: fmtPct(summary.total_return_pct),
      color: pnlColor(summary.total_return_pct),
    },
    {
      label: 'Max drawdown',
      value: fmtPct(summary.max_drawdown_pct),
      color: 'var(--color-bear)',
    },
    { label: 'Profit factor', value: fmtNumber(summary.profit_factor) },
    { label: '# Trades', value: String(summary.n_trades) },
    { label: 'Avg hold (min)', value: fmtNumber(summary.avg_hold_minutes, 0) },
  ];
  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="zg-feature-shell p-4"
        >
          <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
            {c.label}
          </div>
          <div
            className="mt-1 text-xl font-bold font-mono"
            style={{ color: c.color ?? 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}
          >
            {c.value}
          </div>
        </div>
      ))}
    </section>
  );
}

// A compact metric tile shared by the tearsheet and Monte Carlo panels.
function Metric({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: string;
  color?: string;
  hint?: string;
}) {
  return (
    <div
      className="rounded-lg border p-3"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-subtle)' }}
    >
      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
        {label}
      </div>
      <div
        className="mt-1 text-lg font-bold font-mono"
        style={{ color: color ?? 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 text-[10px] text-[var(--color-text-secondary)] leading-snug">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Risk-adjusted tearsheet — the metrics a skeptic checks before believing a
 * headline win rate. Only rendered once a run has trades.
 */
function TearsheetPanel({ summary }: { summary: BacktestSummary }) {
  if (!summary.n_trades) return null;
  const tstat = summary.expectancy_tstat;
  const bench = summary.benchmark;
  const metrics: { label: string; value: string; color?: string; hint?: string }[] = [
    { label: 'Sharpe', value: fmtNumber(summary.sharpe) },
    { label: 'Sortino', value: fmtNumber(summary.sortino) },
    { label: 'Calmar', value: fmtNumber(summary.calmar) },
    {
      label: 'CAGR',
      value: fmtPct(summary.cagr_pct),
      color: summary.cagr_pct != null ? pnlColor(summary.cagr_pct) : undefined,
    },
    { label: 'Ann. volatility', value: fmtPct(summary.annual_volatility_pct) },
    {
      label: 'Expectancy / trade',
      value: fmtCurrency(summary.expectancy),
      color: summary.expectancy != null ? pnlColor(summary.expectancy) : undefined,
    },
    { label: 'Payoff ratio', value: fmtNumber(summary.payoff_ratio) },
    { label: 'Exposure', value: fmtPct(summary.exposure_pct, 1) },
    { label: 'Avg win', value: fmtCurrency(summary.avg_win), color: 'var(--color-bull)' },
    { label: 'Avg loss', value: fmtCurrency(summary.avg_loss), color: 'var(--color-bear)' },
    { label: 'Max loss streak', value: fmtNumber(summary.max_consecutive_losses, 0) },
    {
      label: 'Edge t-stat',
      value: fmtNumber(tstat),
      hint:
        tstat != null
          ? Math.abs(tstat) >= 2
            ? 'significant (|t| ≥ 2)'
            : 'not yet significant'
          : undefined,
    },
  ];
  return (
    <section className="zg-feature-shell p-6">
      <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
        <Gauge size={20} /> Performance tearsheet
      </h2>
      <p className="text-xs text-[var(--color-text-secondary)] mb-4">
        Risk-adjusted, net of modeled fills, slippage, and commission.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metrics.map((m) => (
          <Metric key={m.label} {...m} />
        ))}
      </div>
      {bench ? (
        <div
          className="mt-4 rounded-lg border p-3 text-sm flex flex-wrap items-center gap-x-6 gap-y-1"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <span className="text-[var(--color-text-secondary)] flex items-center gap-1.5">
            <Activity size={15} /> Strategy vs. benchmark:
          </span>
          <span>
            Strategy{' '}
            <b className="font-mono" style={{ color: pnlColor(summary.total_return_pct) }}>
              {fmtPct(summary.total_return_pct)}
            </b>
          </span>
          <span>
            Buy &amp; hold {bench.underlying}{' '}
            <b className="font-mono" style={{ color: pnlColor(bench.buy_hold_return_pct) }}>
              {fmtPct(bench.buy_hold_return_pct)}
            </b>
          </span>
          <span>
            Excess{' '}
            <b
              className="font-mono"
              style={{ color: pnlColor(summary.total_return_pct - bench.buy_hold_return_pct) }}
            >
              {fmtPct(summary.total_return_pct - bench.buy_hold_return_pct)}
            </b>
          </span>
        </div>
      ) : null}
    </section>
  );
}

function gammaRegimeLabel(regime: string): string {
  if (regime === 'positive') return 'Positive γ (suppressive)';
  if (regime === 'negative') return 'Negative γ (amplifying)';
  if (regime === 'flat') return 'Flat γ';
  return 'Unknown';
}

function msiRegimeLabel(regime: string): string {
  return regime === 'unknown' ? 'Unknown' : regime.replace(/_/g, ' ');
}

function RegimeTable({
  title,
  rows,
  labeler,
}: {
  title: string;
  rows: BacktestRegimeBreakdown[];
  labeler: (r: string) => string;
}) {
  if (rows.length === 0) {
    return <div className="text-sm text-[var(--color-text-secondary)]">{title}: no data.</div>;
  }
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-secondary)] mb-2">
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-[var(--color-text-secondary)] text-left border-b"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <th className="py-1.5 pr-3 font-medium">Regime</th>
              <th className="py-1.5 pr-3 font-medium text-right">Trades</th>
              <th className="py-1.5 pr-3 font-medium text-right">Win %</th>
              <th className="py-1.5 pr-3 font-medium text-right">Net P&amp;L</th>
              <th className="py-1.5 font-medium text-right">Exp/trade</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.regime}
                className="border-b last:border-0"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <td className="py-1.5 pr-3">{labeler(r.regime)}</td>
                <td className="py-1.5 pr-3 text-right font-mono">{r.n}</td>
                <td className="py-1.5 pr-3 text-right font-mono">
                  {r.win_rate != null ? fmtPct(r.win_rate * 100, 0) : '—'}
                </td>
                <td
                  className="py-1.5 pr-3 text-right font-mono"
                  style={{ color: pnlColor(r.net_pnl) }}
                >
                  {fmtCurrency(r.net_pnl)}
                </td>
                <td
                  className="py-1.5 text-right font-mono"
                  style={{ color: r.expectancy != null ? pnlColor(r.expectancy) : undefined }}
                >
                  {fmtCurrency(r.expectancy)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Win rate / net / expectancy split by the gamma & MSI regime at entry. */
function RegimeBreakdown({ summary }: { summary: BacktestSummary }) {
  const byRegime = summary.by_regime;
  if (!byRegime || (byRegime.gamma.length === 0 && byRegime.msi.length === 0)) return null;
  return (
    <section className="zg-feature-shell p-6">
      <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
        <Layers size={20} /> Results by market regime
      </h2>
      <p className="text-xs text-[var(--color-text-secondary)] mb-4">
        The ZeroGEX edge: how the same rules performed under different dealer-gamma backdrops.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RegimeTable title="Gamma regime" rows={byRegime.gamma} labeler={gammaRegimeLabel} />
        <RegimeTable title="MSI regime" rows={byRegime.msi} labeler={msiRegimeLabel} />
      </div>
    </section>
  );
}

/** Monte Carlo: the distribution of outcomes, not a single lucky equity line. */
function MonteCarloPanel({ summary, capital }: { summary: BacktestSummary; capital: number }) {
  const mc = summary.monte_carlo;
  if (!mc) return null;
  const tr = mc.terminal_return_pct;
  const stats: { label: string; value: string; color?: string; hint?: string }[] = [
    { label: 'Prob. profitable', value: fmtPct(mc.prob_profit * 100, 0) },
    {
      label: 'Risk of ruin',
      value: fmtPct(mc.risk_of_ruin_50pct * 100, 1),
      color: mc.risk_of_ruin_50pct > 0 ? 'var(--color-bear)' : undefined,
      hint: '≥50% drawdown',
    },
    { label: 'Median return', value: fmtPct(tr.p50), color: pnlColor(tr.p50) },
    { label: 'Range (p5–p95)', value: `${fmtPct(tr.p5)} … ${fmtPct(tr.p95)}` },
    { label: 'Median max DD', value: fmtPct(mc.max_drawdown_pct.p50), color: 'var(--color-bear)' },
    {
      label: 'Worst max DD (p95)',
      value: fmtPct(mc.max_drawdown_pct.p95),
      color: 'var(--color-bear)',
    },
  ];
  return (
    <section className="zg-feature-shell p-6">
      <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
        <Shuffle size={20} /> Monte Carlo outcomes
      </h2>
      <p className="text-xs text-[var(--color-text-secondary)] mb-4">
        {mc.iterations.toLocaleString()} resampled paths of your trade sequence — the realistic
        range of results, not one backtest&apos;s luck.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        {stats.map((s) => (
          <Metric key={s.label} {...s} />
        ))}
      </div>
      <MonteCarloChart cone={mc.cone} startingCapital={capital} />
    </section>
  );
}

// Human-readable labels for the engine's drop-reason codes.
const DROP_LABELS: Record<string, string> = {
  'outcome:no_fill': 'Entry trigger never reached',
  'outcome:no_data': 'No underlying quotes in hold window',
  'outcome:unresolved': 'Non-price exit (premium / event structure)',
  'outcome:no_exit_ts': 'No exit timestamp resolved',
  no_leg: 'No option leg could be selected',
  no_entry_quote: 'No option quote at entry',
  no_exit_quote: 'No option quote at exit',
  bad_premium: 'Invalid entry premium',
  error: 'Pricing error (skipped)',
};

function dropLabel(code: string): string {
  return DROP_LABELS[code] ?? code;
}

/**
 * "Why N trades?" — the funnel from cards loaded → priced → traded, plus the
 * drop breakdown. Makes a low/zero-trade run self-explanatory instead of a
 * silent blank.
 */
function DiagnosticsPanel({
  diagnostics,
  nTrades,
}: {
  diagnostics: NonNullable<BacktestSummary['diagnostics']>;
  nTrades: number;
}) {
  const steps = [
    { label: 'Cards loaded', value: diagnostics.cards_total },
    { label: 'In selected patterns', value: diagnostics.cards_in_scope },
    { label: 'After cooldown', value: diagnostics.cards_after_cooldown },
    { label: 'Priced', value: diagnostics.priced_candidates },
    { label: 'Traded', value: nTrades },
  ];
  const drops = Object.entries(diagnostics.drops ?? {}).sort((a, b) => b[1] - a[1]);
  const hint =
    diagnostics.cards_in_scope === 0
      ? 'None of the selected patterns fired in this window — try other patterns or a wider date range.'
      : diagnostics.priced_candidates === 0 && diagnostics.cards_after_cooldown > 0
        ? 'Cards fired but none could be priced — see the drop reasons below.'
        : nTrades === 0 && diagnostics.priced_candidates > 0
          ? 'Trades were priced but none opened — likely the concurrency cap or sizing.'
          : null;

  return (
    <section className="zg-feature-shell p-6">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Search size={20} />
        Why {nTrades} {nTrades === 1 ? 'trade' : 'trades'}?
      </h2>

      <div className="flex flex-wrap items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            <div className="zg-feature-shell px-3 py-2 text-center min-w-[92px]">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                {s.label}
              </div>
              <div
                className="mt-0.5 text-lg font-bold font-mono"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {s.value}
              </div>
            </div>
            {i < steps.length - 1 ? (
              <span className="text-[var(--color-text-secondary)]">→</span>
            ) : null}
          </div>
        ))}
      </div>

      {hint ? (
        <p className="mt-4 text-sm text-[var(--color-text-secondary)]">{hint}</p>
      ) : null}

      {(drops.length > 0 || diagnostics.concurrency_skipped > 0 || diagnostics.sized_out > 0) ? (
        <div className="mt-4 grid gap-1 text-sm">
          <div className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-secondary)] mb-1">
            Where cards dropped
          </div>
          {drops.map(([code, count]) => (
            <div key={code} className="flex justify-between gap-4">
              <span>{dropLabel(code)}</span>
              <span className="font-mono text-[var(--color-text-secondary)]">{count}</span>
            </div>
          ))}
          {diagnostics.concurrency_skipped > 0 ? (
            <div className="flex justify-between gap-4">
              <span>Skipped — max concurrent positions reached</span>
              <span className="font-mono text-[var(--color-text-secondary)]">
                {diagnostics.concurrency_skipped}
              </span>
            </div>
          ) : null}
          {diagnostics.sized_out > 0 ? (
            <div className="flex justify-between gap-4">
              <span>Skipped — capital couldn&apos;t afford one contract</span>
              <span className="font-mono text-[var(--color-text-secondary)]">
                {diagnostics.sized_out}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ByPatternTable({ summary }: { summary: BacktestSummary }) {
  return (
    <section className="zg-feature-shell p-6">
      <h2 className="text-xl font-semibold mb-4">By Pattern</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--color-text-secondary)] text-xs uppercase tracking-[0.12em]">
              <th className="py-2 pr-4 font-semibold">Pattern</th>
              <th className="py-2 pr-4 font-semibold text-right">Trades</th>
              <th className="py-2 pr-4 font-semibold text-right">Win rate</th>
              <th className="py-2 font-semibold text-right">Net P&L</th>
            </tr>
          </thead>
          <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
            {summary.by_pattern.map((p) => (
              <tr key={p.pattern} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                <td className="py-2 pr-4 font-medium">{p.pattern}</td>
                <td className="py-2 pr-4 text-right font-mono">{p.n}</td>
                <td className="py-2 pr-4 text-right font-mono">{fmtPct(p.win_rate)}</td>
                <td className="py-2 text-right font-mono" style={{ color: pnlColor(p.net_pnl) }}>
                  {fmtCurrency(p.net_pnl)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TradesBlotter({
  page,
  pageIndex,
  loading,
  onPage,
}: {
  page: ReturnType<typeof useBacktest>['trades'];
  pageIndex: number;
  loading: boolean;
  onPage: (page: number) => void;
}) {
  if (!page) {
    return <Skeleton height={240} label="Loading trades…" />;
  }
  if (page.total === 0) {
    return (
      <div className="text-sm text-[var(--color-text-secondary)]">
        This run produced no trades.
      </div>
    );
  }

  const start = pageIndex * TRADES_PAGE_SIZE;
  const end = Math.min(start + page.trades.length, page.total);
  const hasPrev = pageIndex > 0;
  const hasNext = end < page.total;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto" style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 150ms' }}>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[var(--color-text-secondary)] uppercase tracking-[0.1em]">
              <th className="py-2 pr-3 font-semibold">#</th>
              <th className="py-2 pr-3 font-semibold">Pattern</th>
              <th className="py-2 pr-3 font-semibold">Side</th>
              <th className="py-2 pr-3 font-semibold">Contract</th>
              <th className="py-2 pr-3 font-semibold">Entered</th>
              <th className="py-2 pr-3 font-semibold">Exited</th>
              <th className="py-2 pr-3 font-semibold text-right">Entry</th>
              <th className="py-2 pr-3 font-semibold text-right">Exit</th>
              <th className="py-2 pr-3 font-semibold text-right">Qty</th>
              <th className="py-2 pr-3 font-semibold text-right">Δ / V</th>
              <th className="py-2 pr-3 font-semibold text-right">Net P&L</th>
              <th className="py-2 pr-3 font-semibold text-right">Return</th>
              <th className="py-2 font-semibold">Outcome</th>
            </tr>
          </thead>
          <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
            {page.trades.map((t) => (
              <tr key={t.seq} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                <td className="py-1.5 pr-3 font-mono">{t.seq}</td>
                <td className="py-1.5 pr-3">{t.pattern}</td>
                <td className="py-1.5 pr-3 capitalize">{t.direction}</td>
                <td className="py-1.5 pr-3 font-mono">
                  {t.strike}
                  {t.option_type?.charAt(0).toUpperCase()}
                  {t.structure && t.structure !== 'single' ? (
                    <span className="ml-1 text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
                      {t.structure}
                    </span>
                  ) : null}
                </td>
                <td className="py-1.5 pr-3">{formatDateTime(t.entered_at)}</td>
                <td className="py-1.5 pr-3">{formatDateTime(t.exited_at)}</td>
                <td className="py-1.5 pr-3 text-right font-mono">{fmtNumber(t.entry_premium)}</td>
                <td className="py-1.5 pr-3 text-right font-mono">{fmtNumber(t.exit_premium)}</td>
                <td className="py-1.5 pr-3 text-right font-mono">{t.contracts}</td>
                <td className="py-1.5 pr-3 text-right font-mono text-[var(--color-text-secondary)]">
                  {fmtNumber(t.net_delta, 0)} / {fmtNumber(t.net_vega, 0)}
                </td>
                <td className="py-1.5 pr-3 text-right font-mono" style={{ color: pnlColor(t.net_pnl) }}>
                  {fmtCurrency(t.net_pnl)}
                </td>
                <td className="py-1.5 pr-3 text-right font-mono" style={{ color: pnlColor(t.return_pct) }}>
                  {fmtPct(t.return_pct)}
                </td>
                <td className="py-1.5 capitalize">{t.outcome}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {start + 1}–{end} of {page.total}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!hasPrev || loading}
            onClick={() => onPage(pageIndex - 1)}
            className="rounded-md border px-2.5 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ borderColor: 'var(--color-border)' }}
          >
            Prev
          </button>
          <button
            type="button"
            disabled={!hasNext || loading}
            onClick={() => onPage(pageIndex + 1)}
            className="rounded-md border px-2.5 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ borderColor: 'var(--color-border)' }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Shared bits ---------------------------------------------------------

function Skeleton({ height = 200, label }: { height?: number; label?: string }) {
  return (
    <div
      className="rounded-xl border animate-pulse flex items-center justify-center text-xs text-[var(--color-text-secondary)]"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-subtle)', height }}
    >
      {label}
    </div>
  );
}

function ErrorBox({ title, message }: { title: string; message: string }) {
  return (
    <div
      className="rounded-lg border px-4 py-3 text-sm flex items-start gap-2"
      style={{ borderColor: 'var(--color-bear)', background: 'var(--color-bear-soft, transparent)' }}
      role="alert"
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--color-bear)' }} />
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-[var(--color-text-secondary)] mt-0.5">{message}</div>
      </div>
    </div>
  );
}
