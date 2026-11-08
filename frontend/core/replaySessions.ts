/**
 * Daily Replay sessions whose per-strike detail has aged out.
 *
 * The /replay list reads gex_summary, which is never trimmed. The per-strike
 * rows behind the strike profile (gex_by_strike) are deleted after about 60
 * days (see /help/platform/data-coverage, "Historical depth"). So the oldest
 * sessions listed replay their walls, gamma flip and max pain over the tape
 * with an empty strike profile. The API marks them `has_strikes: false`, on
 * both /api/replay/sessions and /api/replay/range.
 *
 * Only an explicit `false` counts. `undefined` (an API from before the field)
 * and `null` (the API couldn't check) leave a session exactly as it was shown
 * before, so a slow database never relabels a recent session as aged out.
 *
 * Pure (no React / no window) so it unit-tests directly.
 */

/** Where the site explains how long each kind of history is kept. */
export const STRIKE_RETENTION_HREF = '/help/platform/data-coverage#historical-depth';

export type ReplaySessionTone = 'full' | 'partial' | 'thin' | 'levels';

/** True only when the API says this session's per-strike rows are gone. */
export function strikesAgedOut(hasStrikes: boolean | null | undefined): boolean {
  return hasStrikes === false;
}

/**
 * The status on a session's card. A session with its strike detail is labeled
 * by how many minutes it has, exactly as before: 380 or more is a full
 * session (a full cash session is 390).
 */
export function replaySessionStatus(
  barCount: number,
  hasStrikes?: boolean | null,
): { label: string; tone: ReplaySessionTone } {
  if (strikesAgedOut(hasStrikes)) return { label: 'Levels only', tone: 'levels' };
  if (barCount >= 380) return { label: 'Full session', tone: 'full' };
  if (barCount >= 120) return { label: 'Partial', tone: 'partial' };
  return { label: 'Thin', tone: 'thin' };
}
