'use client';

import { useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Compass,
  Gauge,
  Layers,
  Zap,
} from 'lucide-react';

interface Props {
  /** Which surface is showing the guide — gets highlighted in the comparison table. */
  current?: 'trade-bias' | 'composite-score' | 'basic-signals' | 'advanced-signals';
  /** Default open state. Closed by default to keep pages tight. */
  defaultOpen?: boolean;
}

const SURFACES = [
  {
    key: 'trade-bias' as const,
    title: 'Trade Bias',
    icon: Compass,
    answers: 'What should I do right now?',
    output: 'Regime + bias + confidence + a numbered playbook',
    use: 'First glance — decide if today is tradable and which direction',
    note: 'Synthesizes the regime + key signals into a single instruction.',
  },
  {
    key: 'composite-score' as const,
    title: 'Composite Score (MSI)',
    icon: Gauge,
    answers: 'How strong is the regime?',
    output: '0 – 100 score from six weighted components',
    use: 'Sanity-check whether trends will run before you size in',
    note: 'High does not mean bullish — it means trends are likely to follow through.',
  },
  {
    key: 'basic-signals' as const,
    title: 'Basic Signals',
    icon: Layers,
    answers: 'Are early flow reads aligned?',
    output: 'Six advisory −100 / +100 scores (not in the MSI)',
    use: 'Catch a regime shift one or two ticks before the MSI does',
    note: 'Weight = 0 in the MSI. Divergence here is an early warning.',
  },
  {
    key: 'advanced-signals' as const,
    title: 'Advanced Signals',
    icon: Zap,
    answers: 'Is a high-conviction setup firing?',
    output: 'Eight −100 / +100 scores with explicit trigger thresholds',
    use: 'Find a tradeable entry once the regime + bias agree',
    note: 'Each card shows "Triggered" or "Stand by". Trade the triggered ones.',
  },
];

const COLOR_KEY = [
  { swatch: 'var(--color-bull)', label: 'Bullish / Trend OK', body: 'Trends can run, flow leans up, MSI ≥ 40.' },
  { swatch: 'var(--color-bear)', label: 'Bearish / Reversal Risk', body: 'Trends fail, flow leans down, MSI < 20.' },
  { swatch: 'var(--color-warning)', label: 'Chop / Neutral / Wait', body: 'Mixed signals, low conviction, MSI 20 – 40.' },
  { swatch: 'var(--color-text-secondary)', label: 'Inactive / No Data', body: 'Window closed (e.g. EOD pre-14:30 ET) or signal idle.' },
];

export default function SignalsGuide({ current, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="zg-feature-shell p-4 mb-6" aria-label="How to read the signals">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-[var(--color-info)]" />
          <span className="text-sm font-semibold">How to read these signals</span>
          <span className="text-[11px] text-[var(--color-text-secondary)] hidden sm:inline">
            · Trade Bias, MSI, Basic, Advanced — what each one tells you and when to use it
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-5">
          {/* Color key */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)] mb-2">
              Color key (consistent across every surface)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {COLOR_KEY.map((c) => (
                <div
                  key={c.label}
                  className="rounded-md border px-2.5 py-1.5 flex items-start gap-2"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0 mt-1"
                    style={{ background: c.swatch }}
                  />
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold">{c.label}</div>
                    <div className="text-[11px] text-[var(--color-text-secondary)] leading-snug">
                      {c.body}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Surface comparison */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)] mb-2">
              The four surfaces — at a glance
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
              {SURFACES.map((s) => {
                const Icon = s.icon;
                const active = s.key === current;
                return (
                  <div
                    key={s.key}
                    className="rounded-lg border p-3 flex flex-col gap-1.5"
                    style={{
                      borderColor: active ? 'var(--color-info)' : 'var(--color-border)',
                      background: active ? 'var(--color-info-soft)' : 'transparent',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={14} className="text-[var(--color-info)]" />
                      <span className="text-[13px] font-semibold">{s.title}</span>
                      {active ? (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-info)] ml-auto">
                          You are here
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-primary)]">
                      <span className="font-semibold">Answers: </span>{s.answers}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-secondary)] leading-snug">
                      <span className="font-semibold text-[var(--color-text-primary)]">Shows: </span>{s.output}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-secondary)] leading-snug">
                      <span className="font-semibold text-[var(--color-text-primary)]">Use when: </span>{s.use}
                    </div>
                    <div className="text-[10px] text-[var(--color-text-secondary)] italic leading-snug mt-auto">
                      {s.note}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* How they relate */}
          <div className="rounded-md border px-3 py-2.5"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-subtle)' }}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)] mb-1.5">
              The flow
            </div>
            <ol className="flex flex-col gap-1 text-[12px] text-[var(--color-text-primary)] list-decimal pl-5">
              <li>
                <span className="font-semibold">Composite Score (MSI)</span> answers <em>is the tape tradable?</em>
                — if it&apos;s low, prefer fades; if it&apos;s high, prefer trend trades.
              </li>
              <li>
                <span className="font-semibold">Trade Bias</span> takes the MSI plus the key flow signals and turns them
                into a single instruction (Buy Dips, Sell Rips, Fade Strength, Range Fade, Wait).
              </li>
              <li>
                <span className="font-semibold">Basic Signals</span> are advisory — they don&apos;t move the MSI but
                can warn of a regime shift before the score reacts.
              </li>
              <li>
                <span className="font-semibold">Advanced Signals</span> tell you <em>when</em> — wait for one to trigger
                in agreement with the bias, then take the trade.
              </li>
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}
