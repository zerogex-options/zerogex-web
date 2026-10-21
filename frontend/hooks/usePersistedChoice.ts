'use client';

/**
 * One remembered choice out of a fixed set, per browser: usePersistedFlag's
 * three-way sibling, for a control like the strike ribbon's size filter.
 *
 * Same shape and the same reasons (hooks/usePersistedFlag): read through
 * useSyncExternalStore so the server render and the hydrating render agree on
 * `initial`, kept in localStorage with an in-memory fallback for browsers that
 * refuse it, and shared between every reader of a key in the tab.
 */

import { useCallback, useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
const memory = new Map<string, string>();

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

export function usePersistedChoice<T extends string>(
  storageKey: string,
  choices: readonly T[],
  initial: T,
): [T, (next: T) => void] {
  const getSnapshot = useCallback((): T => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored != null && (choices as readonly string[]).includes(stored)) return stored as T;
    } catch {
      // Blocked site data: fall through to whatever this session has set.
    }
    const held = memory.get(storageKey);
    return held != null && (choices as readonly string[]).includes(held) ? (held as T) : initial;
  }, [storageKey, choices, initial]);

  const getServerSnapshot = useCallback(() => initial, [initial]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const set = useCallback(
    (next: T) => {
      memory.set(storageKey, next);
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        // Storage unavailable: the memory entry carries it for this session.
      }
      emit();
    },
    [storageKey],
  );

  return [value, set];
}
