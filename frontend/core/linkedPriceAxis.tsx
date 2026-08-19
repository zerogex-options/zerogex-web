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

/** A chart's auto-fit price domain, as reported to the link. */
export type PriceDomain = { min: number; max: number };

/** The shared manual view, relative to whatever base window a chart resolves. */
export type LinkedPriceView = {
  /** Multiplier on the base half-range. 1 = the base window itself. */
  zoom: number;
  /** Pan, in signed multiples of the base half-range. 0 = centered. */
  centerRel: number;
};

export type LinkedPriceAxisValue = {
  /** The shared zoom/pan, or null while every linked chart is auto-fitting. */
  view: LinkedPriceView | null;
  setView: (view: LinkedPriceView | null) => void;
  /**
   * Publish (or, with null, withdraw) this chart's auto-fit domain under a key
   * unique to the chart instance. Safe to call on every domain change: an
   * unchanged report is a no-op, so this cannot drive a render loop.
   */
  reportDomain: (key: string, report: { symbol: string } & PriceDomain | null) => void;
  /** The union of every reported domain for `symbol` — the shared base window. */
  domains: ReadonlyMap<string, PriceDomain>;
};

const LinkedPriceAxisContext = createContext<LinkedPriceAxisValue | null>(null);

/** The link this chart belongs to, or null when its axis is its own. */
export function useLinkedPriceAxis(): LinkedPriceAxisValue | null {
  return useContext(LinkedPriceAxisContext);
}

export function LinkedPriceAxisProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<LinkedPriceView | null>(null);
  const [reports, setReports] = useState<ReadonlyMap<string, { symbol: string } & PriceDomain>>(
    () => new Map(),
  );

  const reportDomain = useCallback<LinkedPriceAxisValue['reportDomain']>((key, report) => {
    setReports((prev) => {
      const current = prev.get(key);
      if (report === null) {
        if (!current) return prev;
        const next = new Map(prev);
        next.delete(key);
        return next;
      }
      // Bail on an identical report so a chart re-reporting the same domain
      // every render can never bounce state back and forth.
      if (
        current &&
        current.symbol === report.symbol &&
        current.min === report.min &&
        current.max === report.max
      ) {
        return prev;
      }
      const next = new Map(prev);
      next.set(key, report);
      return next;
    });
  }, []);

  // Union per symbol: the smallest window that contains what every chart on
  // that symbol would have auto-fitted to on its own.
  const domains = useMemo<ReadonlyMap<string, PriceDomain>>(() => {
    const out = new Map<string, PriceDomain>();
    for (const { symbol, min, max } of reports.values()) {
      if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) continue;
      const current = out.get(symbol);
      out.set(
        symbol,
        current ? { min: Math.min(current.min, min), max: Math.max(current.max, max) } : { min, max },
      );
    }
    return out;
  }, [reports]);

  const value = useMemo<LinkedPriceAxisValue>(
    () => ({ view, setView, reportDomain, domains }),
    [view, reportDomain, domains],
  );

  return (
    <LinkedPriceAxisContext.Provider value={value}>{children}</LinkedPriceAxisContext.Provider>
  );
}
