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

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { readUiCookie, writeUiCookie } from '@/core/uiCookies';

// Every hook instance shares one listener set, so two components reading the
// same key stay in step within a tab — that is what lets Header and Navigation
// share "headerCollapsed" without passing anything between them. The `storage`
// listener below additionally picks up another TAB's change, but only for the
// localStorage-backed flags: writing document.cookie raises no event, so the
// cookie-backed ones settle on the next navigation instead.
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

/**
 * `store` picks where the flag lives:
 *  - 'local'  (default) — localStorage. Invisible to the server, so `initial`
 *    is whatever the component would render before it knows better, and the
 *    stored value lands one frame after mount.
 *  - 'cookie' — readable by the server. Pass the value the SERVER read for
 *    this cookie as `initial` and the first paint is already correct: server
 *    and client derive the same answer from the same cookie, so there is no
 *    mismatch AND no visible correction afterwards.
 */
export function usePersistedFlag(
  storageKey: string,
  initial = false,
  store: 'local' | 'cookie' = 'local',
): [boolean, () => void] {
  // Returns a primitive, so repeated calls compare equal and React settles.
  const getSnapshot = useCallback(() => {
    try {
      const stored = store === 'cookie' ? readUiCookie(storageKey) : localStorage.getItem(storageKey);
      if (stored === 'true') return true;
      if (stored === 'false') return false;
    } catch {
      // Blocked site data — fall through to whatever this session has set.
    }
    return memory.get(storageKey) ?? initial;
  }, [storageKey, initial, store]);

  const getServerSnapshot = useCallback(() => initial, [initial]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // One-time adoption of a preference that predates this cookie. Anyone who
  // set one of these before it moved to a cookie has the value in
  // localStorage and no cookie, and would otherwise silently revert to the
  // default. Their first load after the change still renders the default —
  // the server had no cookie to read — and corrects on mount; every load
  // after that is right from the first paint.
  useEffect(() => {
    if (store !== 'cookie') return;
    if (readUiCookie(storageKey) !== null) return;
    let legacy: string | null = null;
    try {
      legacy = localStorage.getItem(storageKey);
    } catch {
      return;
    }
    if (legacy !== 'true' && legacy !== 'false') return;
    writeUiCookie(storageKey, legacy);
    emit();
  }, [storageKey, store]);

  const toggle = useCallback(() => {
    // Read the live snapshot rather than closing over the rendered `value`, so
    // two toggles dispatched before the next render cannot both act on the
    // same stale reading.
    const next = !getSnapshot();
    memory.set(storageKey, next);
    try {
      if (store === 'cookie') writeUiCookie(storageKey, String(next));
      else localStorage.setItem(storageKey, String(next));
    } catch {
      // Storage unavailable: the memory entry above still carries the change
      // for this session, it just will not survive a reload.
    }
    emit();
  }, [storageKey, store, getSnapshot]);

  return [value, toggle];
}
