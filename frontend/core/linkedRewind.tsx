'use client';

/**
 * One Rewind clock for every replaying instrument on a "My Dashboard" board.
 *
 * Rewind, scrub, Play / Pause or Exit on any Gamma Chart, Gamma Terminal or
 * Dealer Strike Profile on the board and every other one does the same, at the
 * same moment. core/linkedRewindState holds the rules (what is shared, who
 * drives playback, when the clock resets); this is the React wiring.
 *
 * A chart joins with useLinkedRewind and keeps its own Rewind state exactly as
 * before. It hands the hook a `follow` function that applies the board's clock
 * to that state, and calls `publish` whenever the READER changes its Rewind.
 * Publishing only on the reader's actions, never from an effect watching the
 * state, is what keeps a followed change from being echoed back round the
 * board. Its playback timer steps the clock only while `drives()` says it is
 * the chart the reader last worked, so two timers never fight over one clock.
 *
 * A chart that finds no provider above it (every page but My Dashboard) gets
 * null and replays on its own clock, exactly as before.
 */

import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createRewindLink, type RewindLink, type SharedRewind } from './linkedRewindState';

export type { SharedRewind };

export interface LinkedRewind {
  /** Tell the board about a change the reader made to this chart's Rewind. */
  publish: (patch: Partial<SharedRewind>) => void;
  /**
   * True while this chart is the one stepping the board's playback. Read at
   * each playback tick: a chart whose playback another chart took over stops
   * stepping on its very next tick, before React has re-rendered it.
   */
  drives: () => boolean;
}

const LinkedRewindContext = createContext<RewindLink | null>(null);

export function LinkedRewindProvider({ children }: { children: ReactNode }) {
  // A store with listeners rather than React state: the clock steps several
  // times a second during playback, and only the charts on it need to hear.
  const [link] = useState(createRewindLink);
  return <LinkedRewindContext.Provider value={link}>{children}</LinkedRewindContext.Provider>;
}

/**
 * Put this chart's Rewind on the board's clock.
 *
 * @param follow  applies the board's clock to this chart. Called whenever
 *                another chart changes it, and whenever this chart (re)joins a
 *                board that is already rewound: on mount, and each time
 *                `joinKey` changes.
 * @param joinKey changes when the chart drops its own Rewind (a new symbol or
 *                timeframe resets it), so it picks the board's clock back up.
 * @returns the link, or null when there is no board clock.
 */
export function useLinkedRewind(follow: (state: SharedRewind) => void, joinKey: string): LinkedRewind | null {
  const link = useContext(LinkedRewindContext);
  const id = useId();
  const followRef = useRef(follow);
  useEffect(() => {
    followRef.current = follow;
  });

  useEffect(() => {
    if (!link) return;
    return link.join(id, (state) => followRef.current(state));
  }, [link, id]);

  useEffect(() => {
    if (!link) return;
    let state = link.current();
    if (!state.active) return;
    // Resetting dropped this chart's own playback. If it was the one playing
    // the board, pause the board where it stands rather than leave every other
    // chart showing Pause with nothing stepping the clock.
    if (state.playing && link.driving(id)) {
      link.publish(id, { playing: false });
      state = link.current();
    }
    followRef.current(state);
  }, [link, id, joinKey]);

  return useMemo(
    () => (link ? { publish: (patch) => link.publish(id, patch), drives: () => link.driving(id) } : null),
    [link, id],
  );
}
