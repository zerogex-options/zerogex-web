'use client';

/**
 * One price (y) axis shared by every Gamma Chart on a split "My Dashboard"
 * board, so the two halves can be read against each other line by line.
 *
 * Cloning a half and pointing the copy at another expiry (or another
 * underlying) only tells half the story if the two charts sit on different
 * price windows — 770 is a third of the way up one and two thirds up the other,
 * and the comparison has to be done by squinting at the axis labels. Linking
 * puts both on one window, so a level is at the same height on both sides.
 *
 * TWO THINGS ARE SHARED, and they matter in that order:
 *
 *   1. THE BASE WINDOW. Every linked chart reports the domain it would auto-fit
 *      to (`reportDomain`), and charts on the SAME symbol all render the union
 *      of those. That is what makes the halves line up the moment linking is
 *      switched on, with no interaction at all: two expiries of SPY auto-fit to
 *      slightly different bands (their walls and flip differ), and the union is
 *      the smallest window that holds both. Charts on different symbols never
 *      share a window — a union of SPY and QQQ prices is meaningless.
 *
 *   2. THE MANUAL ZOOM / PAN on top of it, held as a zoom multiplier and a pan
 *      expressed as a signed multiple of the base half-range rather than as an
 *      absolute price. Relative is what makes the one representation work for
 *      both cases: two charts on one symbol share a base window, so the same
 *      relative view resolves to the identical absolute prices; two charts on
 *      different underlyings each apply it to their own window and show the
 *      same proportional band around their own price action, which is the only
 *      way SPY and QQQ can be compared at all.
 *
 * The base window only fits itself while nobody has touched either half. The
 * first zoom or pan on either one (time or price) makes the view manual, and
 * from then on each symbol's base window is held as it stood, so the axis
 * moves only when the reader moves it (see core/linkedPriceAxisState). Reset
 * releases it.
 *
 * A chart that finds no provider above it (every page outside a linked board)
 * gets null and keeps its own private axis, exactly as before.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  INITIAL_LINK_STATE,
  holdLinkView,
  linkDomains,
  reportLinkDomain,
  setLinkView,
  type DomainReport,
  type LinkState,
  type LinkedPriceView,
  type PriceDomain,
} from './linkedPriceAxisState';

export type { LinkedPriceView, PriceDomain };

export type LinkedPriceAxisValue = {
  /** The shared zoom/pan, or null while every linked chart is auto-fitting. */
  view: LinkedPriceView | null;
  /** Set the shared zoom/pan, or release it with null (Reset). */
  setView: (view: LinkedPriceView | null) => void;
  /**
   * Take the axis over without moving it, for a zoom or pan through time: the
   * base windows stop fitting themselves, and a zoom/pan already set is kept.
   */
  hold: () => void;
  /**
   * Publish (or, with null, withdraw) this chart's auto-fit domain under a key
   * unique to the chart instance. Safe to call on every domain change: an
   * unchanged report is a no-op, so this cannot drive a render loop.
   */
  reportDomain: (key: string, report: DomainReport | null) => void;
  /**
   * The shared base window per symbol: the union of every reported domain for
   * it, held as it stood once the view went manual.
   */
  domains: ReadonlyMap<string, PriceDomain>;
};

const LinkedPriceAxisContext = createContext<LinkedPriceAxisValue | null>(null);

/** The link this chart belongs to, or null when its axis is its own. */
export function useLinkedPriceAxis(): LinkedPriceAxisValue | null {
  return useContext(LinkedPriceAxisContext);
}

export function LinkedPriceAxisProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LinkState>(INITIAL_LINK_STATE);

  const setView = useCallback<LinkedPriceAxisValue['setView']>((view) => {
    setState((s) => setLinkView(s, view));
  }, []);

  const hold = useCallback(() => {
    setState(holdLinkView);
  }, []);

  const reportDomain = useCallback<LinkedPriceAxisValue['reportDomain']>((key, report) => {
    setState((s) => reportLinkDomain(s, key, report));
  }, []);

  // While held this is the same map on every report, so reports that land
  // while the reader is steering don't re-render the charts.
  const domains = useMemo(() => linkDomains(state), [state]);

  const value = useMemo<LinkedPriceAxisValue>(
    () => ({ view: state.view, setView, hold, reportDomain, domains }),
    [state.view, setView, hold, reportDomain, domains],
  );

  return (
    <LinkedPriceAxisContext.Provider value={value}>{children}</LinkedPriceAxisContext.Provider>
  );
}
