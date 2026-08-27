'use client';

/**
 * One tab-wide store for the Trade Bias horizon, shared by the /trade-bias page
 * and every Trade Bias widget on a board.
 *
 * Backed by useSyncExternalStore over a module-level singleton, the same shape
 * hooks/useSharedExpirations uses, for the same two reasons:
 *   • two surfaces showing the same read must move together — a board holding
 *     two copies of the widget, or a widget beside the page in another tab
 *     pane, must never display two different directional calls for the same
 *     symbol and claim both are "the" Trade Bias;
 *   • every future mount — a later navigation, or a full reload (which
 *     iOS/WebKit triggers on its own under memory pressure) — seeds from the
 *     same persisted value.
 *
 * getServerSnapshot returns the default, so SSR and the hydration render agree
 * and the stored pick is adopted on the client's first commit. That is what
 * lets the <select> render its real value without a one-time effect.
 *
 * The pure read/write/validate contract lives in core/tradeBiasTenor (unit-
 * tested under Node); this file is only the thin React/browser glue.
 */

import { useSyncExternalStore } from 'react';
import {
  DEFAULT_BIAS_TENOR,
  persistBiasTenor,
  resolveBiasTenor,
  type BiasTenor,
} from '@/core/tradeBiasTenor';

// `null` until first read so we lazily hydrate from storage exactly once;
// thereafter it holds the active horizon.
let current: BiasTenor | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): BiasTenor {
  if (current === null) current = resolveBiasTenor();
  return current;
}

function getServerSnapshot(): BiasTenor {
  return DEFAULT_BIAS_TENOR;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Switch the horizon: persist first, then notify every mounted surface in the
 * tab. Persisting on the way through (rather than from an effect) means the
 * pick is in storage before a reload can discard the in-memory value.
 * Stable identity (module scope) so callers can pass it straight to an onChange.
 */
export function setBiasTenor(next: BiasTenor): void {
  if (current === next) return;
  current = next;
  persistBiasTenor(next);
  for (const listener of listeners) listener();
}

export interface SharedBiasTenor {
  tenor: BiasTenor;
  setTenor: (next: BiasTenor) => void;
}

export function useBiasTenor(): SharedBiasTenor {
  const tenor = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { tenor, setTenor: setBiasTenor };
}
