// Pure, self-contained label helpers for instrument/analytics-source UI.
// No runtime registry import (kept node:test-loadable): callers pass the
// analytics source / mode; components read those from the registry. The whole
// point is that the UI can NEVER present an SPX-derived ES level as if it were
// CME futures-options GEX — the labels make the source explicit and honest.

import type { AnalyticsSource } from './registry';

export type LabelTone = 'neutral' | 'info' | 'warning';

export interface SourceLabel {
  title: string;
  subtitle: string | null;
  tone: LabelTone;
}

/**
 * Human label for an analytics source. When `referenceMode` is set for a
 * futures instrument, the source is cash-index projection regardless of the
 * instrument's nominal source, and the label says so plainly.
 */
export function analyticsSourceLabel(
  source: AnalyticsSource,
  opts: { referenceMode?: boolean; targetSymbol?: string; sourceSymbol?: string } = {},
): SourceLabel {
  if (opts.referenceMode || source === 'cash_index_projection') {
    const src = opts.sourceSymbol ?? 'SPX';
    const tgt = opts.targetSymbol ?? 'ES';
    return {
      title: `${src}-derived ${tgt} reference`,
      subtitle: 'Not calculated from CME futures options',
      tone: 'warning',
    };
  }
  if (source === 'cme_futures_options') {
    return { title: 'CME futures options', subtitle: 'True futures-options analytics', tone: 'info' };
  }
  return { title: 'OPRA equity options', subtitle: null, tone: 'neutral' };
}

/** Message shown where a capability is not (yet) available for an instrument. */
export function capabilityUnavailableMessage(
  isFuture: boolean,
  reasons: string[] = [],
): string {
  if (reasons.length) return reasons[0];
  return isFuture
    ? 'This view has not yet been calibrated for CME futures.'
    : 'This view is unavailable for the selected instrument.';
}

/** Short session/exchange descriptor for a futures instrument header. */
export function futuresHeaderLine(exchange: string, sessionLabel = 'Globex'): string {
  return `${exchange} · ${sessionLabel}`;
}
