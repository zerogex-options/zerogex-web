'use client';

// One tab-wide store for the user's expiration-filter selection, shared by every
// chart that filters by expiration (GEX Profile, OI & Exposure by Strike, the
// Gamma Terminal rail, the GEX strike table, the Flow-Analysis contract filter).
//
// Backed by useSyncExternalStore over a module-level singleton so that:
//   • changing the filter on one chart updates every other mounted chart live
//     (e.g. the two charts stacked on /gamma-exposure move together);
//   • every future mount — a later navigation, or a full reload (which iOS/WebKit
//     triggers on its own under memory pressure) — seeds from the same value.
//
// The store is TAB-LOCAL on purpose. It used to mirror another tab's write in
// via the `storage` event, which meant two windows (or a split screen) could
// never hold different expirations — picking one on either side yanked both.
// Now each tab keeps its own live selection in sessionStorage and only the
// last-selected DEFAULT is shared through localStorage, so a new tab still
// opens on your last pick while open tabs stay independent. See the two-layer
// note in core/expirationPersistence.
//
// The pure resolve/persist/normalize contract lives in core/expirationPersistence
// (unit-tested under Node); this file is only the thin React/browser glue.

import { useContext, useSyncExternalStore } from 'react';
import { ExpirationScopeContext } from '@/core/expirationScope';
import {
  ALL_EXPIRATIONS,
  persistExpirations,
  resolveInitialExpirations,
  sameExpirations,
} from '@/core/expirationPersistence';

// `null` until first read so we lazily hydrate from storage exactly once;
// thereafter it holds the canonical (normalized) selection. Its reference only
// changes when the selection changes, which is what useSyncExternalStore needs
// getSnapshot to guarantee (returning a fresh array every call would loop).
let current: string[] | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function getSnapshot(): string[] {
  if (current === null) current = resolveInitialExpirations();
  return current;
}

// SSR + the hydration render both see "All" — a stable frozen reference so React
// can hydrate without a mismatch, then sync to the stored value on the client.
function getServerSnapshot(): readonly string[] {
  return ALL_EXPIRATIONS;
}

// No `storage` listener by design — see the tab-local note at the top of this
// file. Another tab's write must not reach this one; it only updates the
// last-selected default that a FUTURE tab will seed from.
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Update this tab's selection: normalize + write through to storage, then notify
// every mounted chart in the tab. No-ops when the normalized value is unchanged,
// which also breaks the set→broadcast→re-seed loop a chart's local mirror could
// otherwise create. Stable identity (module scope) so callers can pass it
// straight to an onChange without memoizing.
export function setSharedExpirations(next: readonly string[]): void {
  const clean = persistExpirations(next);
  if (current !== null && sameExpirations(current, clean)) return;
  current = clean;
  emit();
}

export interface SharedExpirations {
  /** The active selection; an empty array means "All expirations". */
  selection: string[];
  /**
   * Replace the selection (normalized + persisted + broadcast to every chart in
   * THIS tab; other open tabs keep theirs and only their next fresh mount picks
   * this up as the default).
   */
  setSelection: (next: readonly string[]) => void;
}

export function useSharedExpirations(): SharedExpirations {
  // A subtree can opt out of the tab-wide store — see core/expirationScope. The
  // store is still subscribed to unconditionally (hooks can't be conditional,
  // and useSyncExternalStore over an unchanging value is free), so a scoped
  // chart that later loses its scope picks the shared selection straight back up.
  const scoped = useContext(ExpirationScopeContext);
  const selection = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  ) as string[];
  if (scoped) return scoped;
  return { selection, setSelection: setSharedExpirations };
}
