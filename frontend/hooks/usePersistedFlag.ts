/**
 * A boolean preference remembered per browser — a collapsed panel, a compact
 * widget — read back WITHOUT tripping React's hydration check.
 *
 * Seeding useState straight from localStorage is the obvious way to write
 * this, and it is wrong: the server has no localStorage, so it renders the
 * default while the client renders the stored value, and every load for
 * someone who has changed the setting is a hydration mismatch. React recovers
 * by rebuilding the subtree, so nothing looks broken, but it is a real error
 * on every visit, and it buries genuine mismatches in console noise.
 *
 * useSyncExternalStore is the primitive for exactly this shape — state that
 * lives outside React and has no server equivalent. React renders
 * getServerSnapshot on the server AND for the hydrating render, so the two
 * agree by construction, then swaps to getSnapshot once mounted. The cost is
 * one frame in the default state before a changed preference takes hold.
 */

'use client';

import { useCallback, useSyncExternalStore } from 'react';

// Every hook instance shares one listener set, so two components reading the
// same key stay in step — and a change in another tab lands in this one.
const listeners = new Set<() => void>();

// Fallback for browsers that refuse localStorage (private mode, blocked site
// data, Brave's stricter shields). Without it a blocked write would leave
// getSnapshot returning the old value and the control would not move at all;
// this keeps the toggle working for the session, it just will not outlive it.
const memory = new Map<string, boolean>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  window.addEventListener('storage', onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener('storage', onStoreChange);
  };
}

export function usePersistedFlag(
  storageKey: string,
  initial = false,
): [boolean, () => void] {
  // Returns a primitive, so repeated calls compare equal and React settles.
  const getSnapshot = useCallback(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === 'true') return true;
      if (stored === 'false') return false;
    } catch {
      // Blocked site data — fall through to whatever this session has set.
    }
    return memory.get(storageKey) ?? initial;
  }, [storageKey, initial]);

  const getServerSnapshot = useCallback(() => initial, [initial]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next = !value;
    memory.set(storageKey, next);
    try {
      localStorage.setItem(storageKey, String(next));
    } catch {
      // Storage unavailable: the memory entry above still carries the change
      // for this session, it just will not survive a reload.
    }
    emit();
  }, [storageKey, value]);

  return [value, toggle];
}
