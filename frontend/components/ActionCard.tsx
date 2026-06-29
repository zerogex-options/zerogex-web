// Server-component-safe renderer for a single Action Card emitted by the
// Playbook engine. Used by both the live /trading-signals dashboard and the
// shareable /cards/[id] permalink page, so it stays pure (no hooks, no
// interactivity) and can render under React Server Components.
import { humanize, humanizeText } from '@/core/signalHelpers';
import type {
  SignalActionAlternative,
  SignalActionLeg,
  SignalActionNearMiss,
  SignalActionPriceLevel,
  SignalActionResponse,
} from '@/hooks/useApiData';

export function structureLabel(legCount: number): string {
  if (legCount === 1) return 'Single';
  if (legCount === 2) return 'Vertical';
  if (legCount === 3) return 'Butterfly';
  if (legCount === 4) return 'Condor';
  return `${legCount}-leg`;
}

export function directionColor(direction: string | undefined): string {
  const d = String(direction ?? '').toLowerCase();
  if (d.includes('bull')) return 'var(--color-bull)';
  if (d.includes('bear')) return 'var(--color-bear)';
  return 'var(--color-warning)';
}

function PriceCell({
  label,
  level,
  accent,
}: {
  label: string;
  level: SignalActionPriceLevel | undefined;
  accent: string;
}) {
  const detail = level?.level_name ?? level?.kind ?? level?.trigger ?? '';
  return (
    <div
      className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="text-[10px] uppercase tracking-[0.18em] font-bold" style={{ color: accent }}>
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-bold tracking-tight">
        {level?.ref_price != null ? `$${level.ref_price.toFixed(2)}` : '—'}
      </div>
      {detail && (
        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
          {humanize(detail)}
        </div>
      )}
    </div>
  );
}

function LegRow({ leg }: { leg: SignalActionLeg }) {
  const isBuy = String(leg.side).toUpperCase() === 'BUY';
  const sideColor = isBuy ? 'var(--color-bull)' : 'var(--color-bear)';
  const right = String(leg.right).toUpperCase();
  const rightLabel = right === 'C' ? 'Call' : right === 'P' ? 'Put' : right;
  return (
    <div className="flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
      <span
        className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{ background: `${sideColor}1f`, color: sideColor }}
      >
        {String(leg.side).toUpperCase()}
      </span>
      <span className="font-mono text-[var(--color-text-secondary)]">{leg.qty}×</span>
      <span className="font-mono font-semibold">${Number(leg.strike).toFixed(2)} {rightLabel}</span>
      <span className="ml-auto font-mono text-xs text-[var(--color-text-secondary)]">{leg.expiry}</span>
    </div>
  );
}

export function TradeCard({ data }: { data: SignalActionResponse }) {
  const action = String(data.action ?? '');
  const pattern = String(data.pattern ?? '');
  const tier = String(data.tier ?? '');
  const direction = String(data.direction ?? '');
  const dirColor = directionColor(direction);
  const legs = Array.isArray(data.legs) ? data.legs : [];
  const alternatives = Array.isArray(data.alternatives_considered) ? data.alternatives_considered : [];
  const confidence = typeof data.confidence === 'number' ? data.confidence : null;
  const sizeMultiplier = typeof data.size_multiplier === 'number' ? data.size_multiplier : null;
  const maxHold = typeof data.max_hold_minutes === 'number' ? data.max_hold_minutes : null;
  const confidencePct = confidence != null ? Math.max(0, Math.min(1, confidence)) : 0;

  return (
    <article
      className="rounded-xl border-2 p-6 shadow-sm"
      style={{ borderColor: dirColor, background: `linear-gradient(135deg, ${dirColor}0d 0%, transparent 55%)` }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-text-secondary)]">
            <span style={{ color: dirColor }}>● {data.underlying || 'SPY'}</span>
            <span>·</span>
            <span>Decisive Trade</span>
            {data.timestamp && <span className="font-mono normal-case tracking-normal text-[var(--color-text-secondary)]">{data.timestamp}</span>}
          </div>
          <h3
            className="mt-2 text-3xl md:text-4xl font-black uppercase tracking-tight leading-tight"
            style={{ color: dirColor }}
          >
            {humanize(action)}
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs uppercase tracking-[0.14em] font-semibold text-[var(--color-text-secondary)]">
            {pattern && <span className="font-mono text-[var(--color-text-primary)]">{humanize(pattern)}</span>}
            {pattern && tier && <span className="text-[var(--color-border)]">|</span>}
            {tier && <span className="font-mono text-[var(--color-text-primary)]">{humanize(tier)}</span>}
            {(pattern || tier) && direction && <span className="text-[var(--color-border)]">|</span>}
            {direction && <span style={{ color: dirColor }}>{humanize(direction)}</span>}
            <span className="text-[var(--color-border)]">|</span>
            <span className="font-mono text-[var(--color-text-primary)]">{structureLabel(legs.length)}</span>
          </div>
          {data.rationale && (
            <p className="mt-4 text-sm italic leading-relaxed text-[var(--color-text-secondary)] border-l-2 pl-3" style={{ borderColor: dirColor }}>
              {humanizeText(data.rationale)}
            </p>
          )}
        </div>
        <div className="lg:col-span-4 flex flex-col gap-2 lg:items-end">
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--color-text-secondary)]">Confidence</div>
          <div className="font-mono text-3xl sm:text-4xl md:text-5xl font-black leading-none break-words" style={{ color: dirColor }}>
            {confidence != null ? confidence.toFixed(2) : '—'}
          </div>
          <div className="w-full max-w-[180px] h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
            <div className="h-full" style={{ width: `${confidencePct * 100}%`, background: dirColor }} />
          </div>
          {(sizeMultiplier != null || maxHold != null) && (
            <div className="mt-2 flex gap-4 text-[11px] text-[var(--color-text-secondary)] lg:justify-end">
              {sizeMultiplier != null && (
                <span>Size <span className="font-mono font-semibold text-[var(--color-text-primary)]">×{sizeMultiplier.toFixed(2)}</span></span>
              )}
              {maxHold != null && (
                <span>Max hold <span className="font-mono font-semibold text-[var(--color-text-primary)]">{maxHold}m</span></span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <PriceCell label="Stop" level={data.stop} accent="var(--color-bear)" />
        <PriceCell label="Entry" level={data.entry} accent="var(--color-warning)" />
        <PriceCell label="Target" level={data.target} accent="var(--color-bull)" />
      </div>

      <div className="mt-6">
        <div className="mb-2 text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--color-text-secondary)]">
          Legs · {structureLabel(legs.length)}
        </div>
        {legs.length === 0 ? (
          <div className="text-xs text-[var(--color-text-secondary)]">No legs reported.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {legs.map((leg, idx) => (
              <LegRow key={idx} leg={leg} />
            ))}
          </div>
        )}
      </div>

      {alternatives.length > 0 && (
        <div className="mt-5 pt-3 border-t border-[var(--color-border)]/40 text-[11px] text-[var(--color-text-secondary)] flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-bold uppercase tracking-[0.18em]">Alternatives</span>
          {alternatives.map((alt: SignalActionAlternative, idx) => (
            <span key={idx}>
              {idx > 0 && <span className="text-[var(--color-border)] mr-2">·</span>}
              <span className="font-mono text-[var(--color-text-primary)]">{humanize(alt.pattern)}</span>
              {alt.reason ? <span> ({humanizeText(alt.reason)})</span> : null}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

export function StandDownCard({ data }: { data: SignalActionResponse }) {
  const nearMisses = Array.isArray(data.near_misses) ? data.near_misses : [];

  return (
    <article
      className="rounded-xl border-2 p-6 shadow-sm"
      style={{ borderColor: 'var(--color-warning)', background: 'linear-gradient(135deg, var(--color-warning-soft) 0%, transparent 55%)' }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-text-secondary)]">
        <span style={{ color: 'var(--color-warning)' }}>● {data.underlying || 'SPY'}</span>
        <span>·</span>
        <span>No Trade</span>
        {data.timestamp && <span className="font-mono normal-case tracking-normal">{data.timestamp}</span>}
      </div>
      <h3 className="mt-2 text-3xl md:text-4xl font-black uppercase tracking-tight leading-tight text-[var(--color-warning)]">
        Stand Down
      </h3>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs uppercase tracking-[0.14em] font-semibold text-[var(--color-text-secondary)]">
        <span>Non-directional</span>
        <span className="text-[var(--color-border)]">|</span>
        <span>Confidence <span className="font-mono text-[var(--color-text-primary)]">0.00</span></span>
      </div>
      {data.rationale && (
        <p className="mt-4 text-sm italic leading-relaxed text-[var(--color-text-secondary)] border-l-2 pl-3 border-[var(--color-warning)]">
          {humanizeText(data.rationale)}
        </p>
      )}
      <div className="mt-6">
        <div className="mb-2 text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--color-text-secondary)]">
          Near misses
        </div>
        {nearMisses.length === 0 ? (
          <div className="text-xs text-[var(--color-text-secondary)]">No close patterns reported.</div>
        ) : (
          <ul className="space-y-2 text-sm">
            {nearMisses.map((nm: SignalActionNearMiss, idx) => (
              <li key={idx} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
                <div className="font-mono font-semibold">{humanize(nm.pattern)}</div>
                {Array.isArray(nm.missing) && nm.missing.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 text-xs text-[var(--color-text-secondary)]">
                    {nm.missing.map((m, i) => (
                      <li key={i}>{humanizeText(m)}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
