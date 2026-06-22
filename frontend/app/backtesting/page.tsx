'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertTriangle,
  Download,
  History,
  LineChart as LineChartIcon,
  ListOrdered,
  Play,
  Save,
  Search,
  Share2,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import TooltipWrapper from '@/components/TooltipWrapper';
import { backtestAPI } from '@/core/api/endpoints';
import { useBacktest, TRADES_PAGE_SIZE } from './useBacktest';
import type {
  BacktestCondition,
  BacktestConfigSummary,
  BacktestMeta,
  BacktestSpec,
  BacktestStrategyField,
  BacktestSummary,
  StrategyStructureId,
} from './types';

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
        <TooltipWrapper text={TITLE_TOOLTIP} placement="bottom">
          <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
        </TooltipWrapper>
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
  const { meta, metaState, metaError, running, submit, submitError } = bt;
  const [form, setForm] = useState<FormState | null>(null);

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
      </form>

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

  // Empty state: nothing run yet.
  if (!run && !running) {
    return (
      <section className="zg-feature-shell p-6">
        <EmptyState />
      </section>
    );
  }

  // In-progress: show a progress bar driven by `progress`.
  if (run && (run.status === 'queued' || run.status === 'running')) {
    return (
      <section className="zg-feature-shell p-6">
        <ProgressView status={run.status} progress={run.progress} runId={run.run_id} />
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
