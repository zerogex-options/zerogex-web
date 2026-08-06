'use client';

// One tab-wide store for the user's expiration-filter selection, shared by every
// chart that filters by expiration (GEX Profile, OI & Exposure by Strike, the
// Gamma Terminal rail, the GEX strike table, the Flow-Analysis contract filter).
//
// Backed by useSyncExternalStore over a module-level singleton so that:
//   • changing the filter on one chart updates every other mounted chart live
//     (e.g. the two charts stacked on /gamma-exposure move together);
//   • every future mount — a later navigation, or a full reload (which iOS/WebKit
//     triggers on its own under memory pressure) — seeds from the same value;
//   • a change in another tab mirrors in via the `storage` event.
//
// The pure resolve/persist/normalise contract lives in core/expirationPersistence
// (unit-tested under Node); this file is only the thin React/browser glue.

import { useSyncExternalStore } from 'react';
import {
  ALL_EXPIRATIONS,
  EXPIRATIONS_STORAGE_KEY,
  persistExpirations,
  readStoredExpirations,
  sameExpirations,
} from '@/core/expirationPersistence';

// `null` until first read so we lazily hydrate from localStorage exactly once;
// thereafter it holds the canonical (normalised) selection. Its reference only
// changes when the selection changes, which is what useSyncExternalStore needs
// getSnapshot to guarantee (returning a fresh array every call would loop).
let current: string[] | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function getSnapshot(): string[] {
  if (current === null) current = readStoredExpirations();
  return current;
}

// SSR + the hydration render both see "All" — a stable frozen reference so React
// can hydrate without a mismatch, then sync to the stored value on the client.
function getServerSnapshot(): readonly string[] {
  return ALL_EXPIRATIONS;
}

// Mirror a write from another tab into this tab's store.
function handleStorage(event: StorageEvent): void {
  if (event.key !== null && event.key !== EXPIRATIONS_STORAGE_KEY) return;
  const next = readStoredExpirations();
  if (current !== null && sameExpirations(current, next)) return;
  current = next;
  emit();
}

function subscribe(listener: () => void): () => void {
  // Attach the cross-tab listener only while something is actually subscribed,
  // and only once regardless of how many charts are mounted.
  if (listeners.size === 0 && typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage);
    }
  };
}

// Update the shared selection: normalise + write through to storage, then notify
// every mounted chart. No-ops when the normalised value is unchanged, which also
// breaks the set→broadcast→re-seed loop a chart's local mirror could otherwise
// create. Stable identity (module scope) so callers can pass it straight to an
// onChange without memoising.
export function setSharedExpirations(next: readonly string[]): void {
  const clean = persistExpirations(next);
  if (current !== null && sameExpirations(current, clean)) return;
  current = clean;
  emit();
}

export interface SharedExpirations {
  /** The active selection; an empty array means "All expirations". */
  selection: string[];
  /** Replace the selection (normalised + persisted + broadcast to all charts). */
  setSelection: (next: readonly string[]) => void;
}

export function useSharedExpirations(): SharedExpirations {
  const selection = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  ) as string[];
  return { selection, setSelection: setSharedExpirations };
}
