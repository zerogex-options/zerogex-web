'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

import {
  DEFAULT_WIDE_POINTS,
  EMPTY_PLAN,
  type ChangeWindow,
  type Instrument,
  type RadarPlan,
  type ViewMode,
} from '@/core/fuselineRadar';

/**
 * The Fuseline Radar's remembered state: the trade plan and how the page is
 * set up to read it. Per browser, in localStorage, like the site's other
 * chart preferences.
 *
 * useSyncExternalStore for the reason usePersistedFlag gives: the server has
 * no storage, so it renders the defaults and the client swaps to the stored
 * value after hydration instead of mismatching on every load.
 *
 * A plan is the trader's own numbers, so a corrupt or foreign entry falls back
 * to the defaults field by field rather than throwing the whole thing away.
 */

export type UpdateMode = 'manual' | '1m' | '5m';

export interface RadarSettings {
  plan: RadarPlan;
  display: Instrument;
  view: ViewMode;
  widePoints: number;
  window: ChangeWindow;
  showReference: boolean;
  showLadder: boolean;
  mode: UpdateMode;
}

export const DEFAULT_SETTINGS: RadarSettings = {
  plan: EMPTY_PLAN,
  display: 'ES',
  view: 'AB',
  widePoints: DEFAULT_WIDE_POINTS,
  window: 4,
  showReference: true,
  showLadder: true,
  mode: '1m',
};

const KEY = 'fuselineRadar.v1';
const listeners = new Set<() => void>();
let memory: string | null = null;

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function read(): string | null {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

const finite = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Parse stored settings, keeping every field that is valid on its own. */
export function parseSettings(raw: string | null): RadarSettings {
  if (!raw) return DEFAULT_SETTINGS;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return DEFAULT_SETTINGS;
  }
  if (!obj || typeof obj !== 'object') return DEFAULT_SETTINGS;
  const d = DEFAULT_SETTINGS;
  const p = (obj.plan ?? {}) as Record<string, unknown>;
  const pick = <T,>(v: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(v as T) ? (v as T) : fallback;
  return {
    plan: {
      instrument: pick(p.instrument, ['ES', 'SPX'] as const, d.plan.instrument),
      direction: pick(p.direction, ['up', 'down'] as const, d.plan.direction),
      fuse: finite(p.fuse),
      t1: finite(p.t1),
      t2: finite(p.t2),
    },
    display: pick(obj.display, ['ES', 'SPX'] as const, d.display),
    view: pick(obj.view, ['AB', 'ABC', 'WIDE'] as const, d.view),
    widePoints: (() => {
      const w = finite(obj.widePoints);
      return w != null && w >= 10 && w <= 1000 ? w : d.widePoints;
    })(),
    window: pick(obj.window, [1, 4, 20] as const, d.window),
    showReference: typeof obj.showReference === 'boolean' ? obj.showReference : d.showReference,
    showLadder: typeof obj.showLadder === 'boolean' ? obj.showLadder : d.showLadder,
    mode: pick(obj.mode, ['manual', '1m', '5m'] as const, d.mode),
  };
}

export function useRadarSettings(): [RadarSettings, (patch: Partial<RadarSettings>) => void] {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const settings = useMemo(() => parseSettings(raw), [raw]);

  const update = useCallback((patch: Partial<RadarSettings>) => {
    const next = JSON.stringify({ ...parseSettings(read()), ...patch });
    memory = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage refused (private mode, blocked site data): the memory copy
      // keeps the page working for this visit.
    }
    listeners.forEach((l) => l());
  }, []);

  return [settings, update];
}
