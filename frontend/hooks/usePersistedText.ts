'use client';

/**
 * One remembered string per browser: usePersistedChoice's free-form sibling,
 * for a value the reader types rather than picks, such as the strike ribbon's
 * dot sizes. The caller parses it; anything unreadable should fall back.
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

export function usePersistedText(storageKey: string, initial: string): [string, (next: string) => void] {
  const getSnapshot = useCallback((): string => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored != null) return stored;
    } catch {
      // Blocked site data: fall through to whatever this session has set.
    }
    return memory.get(storageKey) ?? initial;
  }, [storageKey, initial]);

  const getServerSnapshot = useCallback(() => initial, [initial]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const set = useCallback(
    (next: string) => {
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
