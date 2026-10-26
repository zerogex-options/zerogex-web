'use client';

import { useState } from 'react';

import { FilterChip, FilterGroup } from '@/components/controls/Filters';
import { convertPrice, type Instrument, type RadarPlan } from '@/core/fuselineRadar';

/**
 * The trade plan: the Fuse, the direction, and one or two targets, typed in
 * whichever instrument the trader works in. ES by default, because that is
 * where Barrie keeps his Fuse and Field Map.
 *
 * Switching "Plan in" converts the numbers already entered at the current
 * ratio, so the plan keeps pointing at the same prices; the display switch on
 * the page converts for viewing and never touches the plan at all.
 */

function PriceField({
  id,
  label,
  value,
  onCommit,
  placeholder,
}: {
  id: string;
  label: string;
  value: number | null;
  onCommit: (v: number | null) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState(value == null ? '' : value.toFixed(2));
  const commit = () => {
    const t = draft.trim();
    if (t === '') { onCommit(null); return; }
    const n = Number(t.replace(/,/g, ''));
    if (Number.isFinite(n) && n > 0) onCommit(Math.round(n * 100) / 100);
    else setDraft(value == null ? '' : value.toFixed(2));
  };
  return (
    <label htmlFor={id} className="flex items-center gap-2">
      <span className="zg-eyebrow" style={{ fontSize: 10 }}>{label}</span>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        // 16px on a phone so iOS does not zoom the page on focus.
        className="w-24 rounded-md border px-2 py-1 text-xs tabular-nums max-sm:text-base"
        style={{
          borderColor: 'var(--border-default)',
          backgroundColor: 'transparent',
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-mono)',
        }}
      />
    </label>
  );
}

export default function PlanInputs({
  plan,
  ratio,
  onChange,
}: {
  plan: RadarPlan;
  /** ES / SPX, for converting the plan when "Plan in" changes. Null when unknown. */
  ratio: number | null;
  onChange: (plan: RadarPlan) => void;
}) {
  const setInstrument = (next: Instrument) => {
    if (next === plan.instrument) return;
    if (ratio == null) {
      // Without a ratio the numbers cannot be carried across honestly, so the
      // switch waits rather than relabeling ES numbers as SPX.
      return;
    }
    const c = (p: number | null) =>
      p == null ? null : Math.round(convertPrice(p, plan.instrument, next, ratio) * 100) / 100;
    onChange({ ...plan, instrument: next, fuse: c(plan.fuse), t1: c(plan.t1), t2: c(plan.t2) });
  };
  // Keyed on the field AND its committed value, so a conversion, a Clear or the
  // stored plan arriving after hydration resets the draft. The field name keeps
  // two empty fields from sharing a key.
  const k = (field: string, v: number | null) => `${field}:${plan.instrument}:${v ?? ''}`;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <FilterGroup label="Plan in">
        {(['ES', 'SPX'] as const).map((i) => (
          <FilterChip
            key={i}
            active={plan.instrument === i}
            onClick={() => setInstrument(i)}
            disabled={ratio == null && plan.instrument !== i}
            title={ratio == null && plan.instrument !== i ? 'Waiting for the ES/SPX ratio' : undefined}
          >
            {i}
          </FilterChip>
        ))}
      </FilterGroup>
      <FilterGroup label="Direction">
        <FilterChip active={plan.direction === 'up'} onClick={() => onChange({ ...plan, direction: 'up' })}>Up</FilterChip>
        <FilterChip active={plan.direction === 'down'} onClick={() => onChange({ ...plan, direction: 'down' })}>Down</FilterChip>
      </FilterGroup>
      <PriceField key={k('fuse', plan.fuse)} id="fr-fuse" label="Fuse" value={plan.fuse} placeholder="Required" onCommit={(v) => onChange({ ...plan, fuse: v })} />
      <PriceField key={k('t1', plan.t1)} id="fr-t1" label="Target 1" value={plan.t1} placeholder="Required" onCommit={(v) => onChange({ ...plan, t1: v })} />
      <PriceField key={k('t2', plan.t2)} id="fr-t2" label="Target 2" value={plan.t2} placeholder="Optional" onCommit={(v) => onChange({ ...plan, t2: v })} />
      {(plan.fuse != null || plan.t1 != null || plan.t2 != null) && (
        <button
          type="button"
          onClick={() => onChange({ ...plan, fuse: null, t1: null, t2: null })}
          className="rounded px-2 py-1 text-xs underline-offset-2 hover:underline max-sm:min-h-8"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Clear plan
        </button>
      )}
    </div>
  );
}
