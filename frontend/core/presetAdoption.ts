// Did a quick-start preset actually become someone's board?
//
// Applying a preset was never recorded, and even a click would not have
// answered the question that matters. The 0DTE preset was built for a named
// subscriber who then did not use it; we learned that only because he
// mentioned it weeks later. "Applied" is a moment, "adopted" is a habit, and
// only the second one says whether the preset was the right build.
//
// Per-browser, like the layout it describes (see `myDashboardLayout.ts`), and
// deliberately tiny: a preset id, the day it was applied, and the last day we
// reported on it. No layout contents, nothing identifying.

const STORAGE_KEY = 'zg.dashboard.presetAdoption.v1';

interface PresetStamp {
  preset: string;
  /** UTC date (YYYY-MM-DD) the preset was applied. */
  appliedOn: string;
  /** UTC date of the last retention report, so it fires once a day at most. */
  lastReportedOn?: string;
}

type StampsByScope = Record<string, PresetStamp>;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

function read(): StampsByScope {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as StampsByScope) : {};
  } catch {
    // Private mode, blocked storage, or corrupt JSON. Losing adoption
    // telemetry must never break the board itself.
    return {};
  }
}

function write(next: StampsByScope): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — telemetry is best-effort */
  }
}

function scopeKey(scope?: string | null): string {
  return scope ?? '__default__';
}

/** Record that `preset` seeded this scope's board today. */
export function notePresetApplied(preset: string, scope?: string | null): void {
  const all = read();
  all[scopeKey(scope)] = { preset, appliedOn: today() };
  write(all);
}

export interface PresetRetention {
  preset: string;
  days_since_applied: number;
  /** The board still exists but has been edited since the preset seeded it. */
  modified: boolean;
}

/**
 * Report that a preset-seeded board is still in use, at most once per day and
 * never on the day it was applied.
 *
 * Returns the event properties to send, or `null` when there is nothing to
 * report. An emptied board clears the stamp: that is abandonment, and counting
 * it as retention would make the metric lie in the one direction that matters.
 */
export function reportPresetRetention(
  scope: string | null | undefined,
  layoutIsEmpty: boolean,
  isModified = false,
): PresetRetention | null {
  const key = scopeKey(scope);
  const all = read();
  const stamp = all[key];
  if (!stamp) return null;

  if (layoutIsEmpty) {
    delete all[key];
    write(all);
    return null;
  }

  const now = today();
  const days = daysBetween(stamp.appliedOn, now);
  // Same day tells us nothing — they are still setting it up.
  if (days < 1) return null;
  if (stamp.lastReportedOn === now) return null;

  all[key] = { ...stamp, lastReportedOn: now };
  write(all);
  return { preset: stamp.preset, days_since_applied: days, modified: isModified };
}

/** Testing seam. */
export const __presetAdoptionInternals = { STORAGE_KEY, daysBetween };
