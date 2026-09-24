/**
 * The state behind core/linkedPriceAxis (the one price axis the Gamma Charts
 * on a linked, split My Dashboard board share), as pure transitions so the
 * rules can be pinned by tests rather than by dragging two charts about.
 *
 * Three things are held:
 *
 *   • `reports`: the window each linked chart would auto-fit to on its own,
 *     keyed per chart instance. Always live; charts keep reporting as their
 *     data moves.
 *   • `view`: the shared manual zoom / pan, or null while nobody has touched
 *     either half and both fit themselves.
 *   • `held`: per symbol, the base window the charts draw from while `view`
 *     is manual. Null while they fit themselves.
 *
 * `held` is what stops a linked axis re-scaling itself under a reader who has
 * taken it over. The base window is the union of the reports for a symbol,
 * and the reports move with every tick, every flip or wall that moves, and
 * every pan through time, so a zoom applied on top of the live union kept
 * changing scale with nobody touching it. The moment the view goes manual,
 * each symbol's union is captured as it stands, and the charts draw from that
 * until the view is released (Reset). A symbol that first reports while the
 * view is held (a half switched to another underlying) is held at the window
 * it arrives with.
 */

/** A chart's auto-fit price domain, as reported to the link. */
export type PriceDomain = { min: number; max: number };

/** One chart's report: its auto-fit domain, and the symbol it is for. */
export type DomainReport = { symbol: string } & PriceDomain;

/** The shared manual view, relative to whatever base window a chart resolves. */
export type LinkedPriceView = {
  /** Multiplier on the base half-range. 1 = the base window itself. */
  zoom: number;
  /** Pan, in signed multiples of the base half-range. 0 = centered. */
  centerRel: number;
};

export type LinkState = {
  readonly view: LinkedPriceView | null;
  readonly reports: ReadonlyMap<string, DomainReport>;
  readonly held: ReadonlyMap<string, PriceDomain> | null;
};

export const INITIAL_LINK_STATE: LinkState = { view: null, reports: new Map(), held: null };

/** A view that is manual but has not moved: exactly the base window. */
export const UNMOVED_VIEW: LinkedPriceView = { zoom: 1, centerRel: 0 };

/**
 * Union per symbol: the smallest window that contains what every chart on that
 * symbol would have auto-fitted to on its own. Degenerate reports are skipped.
 */
export function unionBySymbol(reports: Iterable<DomainReport>): Map<string, PriceDomain> {
  const out = new Map<string, PriceDomain>();
  for (const { symbol, min, max } of reports) {
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) continue;
    const current = out.get(symbol);
    out.set(
      symbol,
      current ? { min: Math.min(current.min, min), max: Math.max(current.max, max) } : { min, max },
    );
  }
  return out;
}

/** The base window per symbol the charts draw from: held while the view is
 *  manual, the live union otherwise. */
export function linkDomains(state: LinkState): ReadonlyMap<string, PriceDomain> {
  return state.held ?? unionBySymbol(state.reports.values());
}

/**
 * Set the shared zoom / pan, or release it with null. The first manual view
 * holds every symbol's window as it stands; releasing lets them fit
 * themselves again.
 */
export function setLinkView(state: LinkState, view: LinkedPriceView | null): LinkState {
  if (view === state.view) return state;
  if (view === null) return { ...state, view: null, held: null };
  return { ...state, view, held: state.held ?? unionBySymbol(state.reports.values()) };
}

/**
 * Take the axis over without moving it, for the gestures that do not zoom or
 * pan the price axis themselves (a zoom or pan through time). Holds the
 * windows if they are not held already, and leaves an existing zoom / pan
 * exactly as it is.
 */
export function holdLinkView(state: LinkState): LinkState {
  return state.view ? state : setLinkView(state, UNMOVED_VIEW);
}

/**
 * Publish (or, with null, withdraw) one chart's auto-fit domain under a key
 * unique to the chart instance. Safe to call on every domain change: an
 * unchanged report returns the same state, so it cannot drive a render loop.
 */
export function reportLinkDomain(state: LinkState, key: string, report: DomainReport | null): LinkState {
  const current = state.reports.get(key);
  if (report === null) {
    if (!current) return state;
    const reports = new Map(state.reports);
    reports.delete(key);
    return { ...state, reports };
  }
  // Bail on an identical report so a chart re-reporting the same domain every
  // render can never bounce state back and forth.
  if (
    current &&
    current.symbol === report.symbol &&
    current.min === report.min &&
    current.max === report.max
  ) {
    return state;
  }
  const reports = new Map(state.reports);
  reports.set(key, report);
  // While held, a symbol already on the board keeps its window, however its
  // reports move. One arriving for the first time is held at the window it
  // arrives with.
  let held = state.held;
  if (held && !held.has(report.symbol)) {
    const arrived = unionBySymbol(reports.values()).get(report.symbol);
    if (arrived) held = new Map(held).set(report.symbol, arrived);
  }
  return { ...state, reports, held };
}
