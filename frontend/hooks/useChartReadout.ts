'use client';

/**
 * Which bar a hand-drawn chart's readout shows, and the pointer handlers that
 * clear it.
 *
 * A mouse shows the readout while it is over the plot and clears it on the way
 * out. A finger keeps it after lifting, so a tap can be read without a hand
 * over the numbers: the next press anywhere off the chart clears it, and so
 * does a gesture the browser takes for a scroll (the browser cancels the
 * pointer). Touch fires its leave as the finger lifts, which is why a leave
 * alone cannot be the signal.
 */

import { useEffect, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

export interface ChartReadout {
  /** The bar under the pointer, or the one a tap left showing. */
  index: number | null;
  setIndex: (index: number | null) => void;
  onPointerLeave: (e: ReactPointerEvent) => void;
  onPointerCancel: () => void;
}

/** `wrapRef` is the chart's own box: a press inside it is the chart's. */
export function useChartReadout(wrapRef: RefObject<HTMLElement | null>): ChartReadout {
  const [index, setIndex] = useState<number | null>(null);
  const showing = index != null;

  useEffect(() => {
    if (!showing) return;
    const onPress = (e: PointerEvent) => {
      const wrap = wrapRef.current;
      if (wrap && e.target instanceof Node && wrap.contains(e.target)) return;
      setIndex(null);
    };
    document.addEventListener('pointerdown', onPress, true);
    return () => document.removeEventListener('pointerdown', onPress, true);
  }, [showing, wrapRef]);

  return {
    index,
    setIndex,
    onPointerLeave: (e) => {
      if (e.pointerType !== 'touch') setIndex(null);
    },
    onPointerCancel: () => setIndex(null),
  };
}
