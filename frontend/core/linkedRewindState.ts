/**
 * The state behind one replay clock shared by every Rewind on a "My Dashboard"
 * board (see core/linkedRewind for the React side).
 *
 * A board can carry several instruments that replay the session — a Gamma
 * Chart, a Gamma Terminal, a Dealer Strike Profile, two of any of them on
 * different underlyings. Each one used to keep its own clock, so rewinding one
 * left the others live and the board told two stories at once. Linked, they
 * read one clock: entering Rewind, scrubbing, Play / Pause and Exit on any of
 * them moves all of them.
 *
 * THE CLOCK IS A MOMENT, NOT A BAR. Charts on one board can sit on different
 * timeframes (a 1-min Gamma Chart beside a 5-min strike profile), so a bar
 * index means nothing to the chart next to it. What is shared is the instant
 * being replayed, in epoch ms, and each chart resolves its own bar from it.
 *
 * ONE CHART DRIVES PLAYBACK. Every chart keeps its own playback timer, built
 * for its own bars, and two timers stepping one clock would fight. So the chart
 * the reader last worked is the driver: it runs its timer and publishes each
 * step, and the rest follow what it publishes (showing Pause, since the board
 * is playing). Working any other chart makes that one the driver. If the
 * driver leaves the board mid-playback, playback stops rather than leaving the
 * rest showing Pause with nothing stepping the clock.
 *
 * The link lives only while a chart is on it: when the last one leaves (the
 * board is switched, or the last Rewind-capable tile removed), the clock goes
 * back to live, so a tile added later doesn't open in a replay nobody started.
 *
 * Pure (no React) so the hand-off rules can be pinned by tests.
 */

export interface SharedRewind {
  /** True while the board is rewound. */
  active: boolean;
  /** The moment being replayed, in epoch ms; null while live. */
  time: number | null;
  /** True while playback is stepping the clock forward. */
  playing: boolean;
}

export const LIVE_REWIND: SharedRewind = { active: false, time: null, playing: false };

export type RewindListener = (state: SharedRewind) => void;

export interface RewindLink {
  /** The board's clock as it stands. */
  current(): SharedRewind;
  /**
   * A change the reader made on chart `source`, merged into the clock (so a
   * Pause need not restate the moment). Every other chart on the link is told;
   * the source, which already shows it, is not. While the result is playing,
   * the source is the driver (see the header).
   */
  publish(source: string, patch: Partial<SharedRewind>): void;
  /** True while chart `member` is the one stepping playback. */
  driving(member: string): boolean;
  /** Put chart `member` on the link. Returns the function that takes it off. */
  join(member: string, listener: RewindListener): () => void;
}

export function createRewindLink(): RewindLink {
  let state: SharedRewind = LIVE_REWIND;
  let driver: string | null = null;
  const members = new Map<string, RewindListener>();

  const tell = (except: string | null) => {
    // Copied first: a listener may make its chart leave or join.
    for (const [id, listener] of [...members]) {
      if (id !== except) listener(state);
    }
  };

  return {
    current: () => state,

    publish(source, patch) {
      const next = { ...state, ...patch };
      state = next.active ? { active: true, time: next.time, playing: next.playing } : LIVE_REWIND;
      driver = state.playing ? source : null;
      tell(source);
    },

    driving: (member) => driver === member,

    join(member, listener) {
      members.set(member, listener);
      return () => {
        if (members.get(member) !== listener) return;
        members.delete(member);
        if (members.size === 0) {
          state = LIVE_REWIND;
          driver = null;
          return;
        }
        if (driver === member && state.playing) {
          state = { ...state, playing: false };
          driver = null;
          tell(null);
        }
      };
    },
  };
}

/**
 * The bar a follower shows for the shared clock: the newest bar that had
 * CLOSED by `time` — its start plus `barMs` at or before the moment.
 *
 * Strictly backward-looking, for the reason core/rewindBucket gives: a replay
 * that draws a bar before the moment it closed shows the reader the future. A
 * 5-min chart following a 1-min chart's clock at 10:07 therefore holds the
 * 10:00 bar until the 10:05 bar has closed at 10:10.
 *
 * The one exception is the newest bar, which is shown once the clock reaches
 * its start: it is the forming bar, as it stands now, so nothing in it is
 * later than the moment being replayed. This is what keeps entering Rewind
 * from a 1-min chart from moving a 5-min chart one bar back.
 *
 * Returns null when no bar qualifies (the clock is before the first bar has
 * closed) or there are no bars.
 *
 * @param starts bar start times in epoch ms, ascending.
 */
export function barIndexAsOf(starts: readonly number[], barMs: number, time: number): number | null {
  if (starts.length === 0 || !Number.isFinite(time)) return null;
  const last = starts.length - 1;
  if (Number.isFinite(starts[last]) && starts[last] <= time) return last;
  let found: number | null = null;
  for (let i = 0; i < last; i++) {
    const start = starts[i];
    if (!Number.isFinite(start)) continue;
    if (start + barMs - 1 <= time) found = i;
    else break;
  }
  return found;
}
