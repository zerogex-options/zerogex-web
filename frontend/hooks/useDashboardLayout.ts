'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  WidgetState,
  defaultLayout,
  reconcileLayout,
} from '@/core/dashboardWidgets';

const STORAGE_KEY = 'zgx_dashboard_layout';
const SAVE_DEBOUNCE_MS = 800;

function readLocal(): WidgetState[] {
  if (typeof window === 'undefined') return defaultLayout();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultLayout();
    return reconcileLayout(JSON.parse(raw) as Array<{ id: string; visible: boolean }>);
  } catch {
    return defaultLayout();
  }
}

function writeLocal(widgets: WidgetState[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
  } catch {
    /* quota / private mode — server copy is the source of truth anyway */
  }
}

export function useDashboardLayout() {
  // Deterministic default on the server; localStorage-backed on the client
  // (same SSR-safe pattern as ThemeContext/TimeframeContext).
  const [widgets, setWidgets] = useState<WidgetState[]>(readLocal);
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const authedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pull the account-backed layout on mount; it wins over the local mirror so
  // the dashboard follows the user across devices.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/account/dashboard', { credentials: 'include' });
        if (cancelled) return;
        if (res.ok) {
          authedRef.current = true;
          const payload = (await res.json()) as { widgets: Array<{ id: string; visible: boolean }> | null };
          if (payload.widgets) {
            const reconciled = reconcileLayout(payload.widgets);
            setWidgets(reconciled);
            writeLocal(reconciled);
          }
        }
      } catch {
        /* offline / anon — keep the local layout */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistToServer = useCallback((next: WidgetState[]) => {
    if (!authedRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const csrfRes = await fetch('/api/auth/csrf', { credentials: 'include' });
        const csrf = (await csrfRes.json()) as { csrfToken?: string };
        if (!csrf.csrfToken) return;
        await fetch('/api/account/dashboard', {
          method: 'PUT',
          headers: { 'x-csrf-token': csrf.csrfToken, 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ widgets: next }),
        });
      } catch {
        /* best-effort; the local mirror still holds the layout */
      }
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const commit = useCallback(
    (next: WidgetState[]) => {
      setWidgets(next);
      writeLocal(next);
      persistToServer(next);
    },
    [persistToServer]
  );

  const reorder = useCallback(
    (dragId: string, overId: string) => {
      if (dragId === overId) return;
      setWidgets((prev) => {
        const from = prev.findIndex((w) => w.id === dragId);
        const to = prev.findIndex((w) => w.id === overId);
        if (from === -1 || to === -1) return prev;
        const next = prev.slice();
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        writeLocal(next);
        persistToServer(next);
        return next;
      });
    },
    [persistToServer]
  );

  const nudge = useCallback(
    (id: string, dir: -1 | 1) => {
      setWidgets((prev) => {
        const idx = prev.findIndex((w) => w.id === id);
        const swap = idx + dir;
        if (idx === -1 || swap < 0 || swap >= prev.length) return prev;
        const next = prev.slice();
        [next[idx], next[swap]] = [next[swap], next[idx]];
        writeLocal(next);
        persistToServer(next);
        return next;
      });
    },
    [persistToServer]
  );

  const setVisible = useCallback(
    (id: string, visible: boolean) => {
      setWidgets((prev) => {
        const next = prev.map((w) => (w.id === id ? { ...w, visible } : w));
        writeLocal(next);
        persistToServer(next);
        return next;
      });
    },
    [persistToServer]
  );

  const reset = useCallback(() => {
    commit(defaultLayout());
  }, [commit]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return {
    widgets,
    loaded,
    editing,
    setEditing,
    reorder,
    nudge,
    hide: (id: string) => setVisible(id, false),
    add: (id: string) => setVisible(id, true),
    reset,
  };
}
