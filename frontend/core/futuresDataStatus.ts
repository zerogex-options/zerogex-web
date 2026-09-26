/**
 * One switch for the ES / NQ market-data disclosure.
 *
 * TradeStation sells CME data as separate delayed and real-time packages. The
 * account ran on the DELAYED package during the ES / NQ rollout, which put
 * every ES / NQ price on the site — the live terminal quote and the reference
 * spot on the free gamma-levels pages alike — roughly 10 minutes behind the
 * futures market. The real-time CME entitlement is now provisioned, so that
 * standing delay is gone and this reads false.
 *
 * What the flag means, stated as the two states it has:
 *
 *   true  — a KNOWN, structural delay applies to every ES / NQ price. Say so
 *           in prose, and promise it is temporary.
 *   false — ES / NQ are real-time. There is no standing delay to disclose, so
 *           a lagging quote is a feed that has STALLED, not an entitlement.
 *
 * That second state is why the copy is gated rather than deleted: the words
 * "delayed CME feed" are true in the first state and a misdiagnosis in the
 * second, where the same badge has to read as a fault.
 *
 * To flip it back, ES / NQ must report sub-minute ages — see Step 1a of
 * docs/runbooks/es_nq_futures_rollout.md in zerogex-oa for the query, and run
 * it during the cash session with SPY/QQQ as the real-time control.
 *
 * The terminal's delay BADGE is not gated on this at all — it reads the
 * quote's own `data_age_seconds`, so it keeps working in both states and
 * clears itself when the feed catches up. This constant only chooses which
 * CAUSE the badge names, plus the static prose on the free pages, which have
 * no live freshness value to read.
 */
export const FUTURES_REALTIME_PENDING = false;

/** Sentence for static, server-rendered pages that cannot measure the lag. */
export function futuresDelayNote(symbol: string): string {
  if (!FUTURES_REALTIME_PENDING) return '';
  return ` ${symbol} prices currently come from a delayed CME feed and can run about 10 minutes further behind while real-time futures data is being enabled; the levels themselves are unaffected.`;
}

/**
 * The delay badge's full tooltip: what is lagging, why, and what is not.
 *
 * Lives here rather than in the badge because the CAUSE clause is the second
 * thing FUTURES_REALTIME_PENDING governs, and this module exists so there is
 * exactly one place to remember when the entitlement changes.
 *
 * The measured NUMBER is the same in both states; only the cause differs, and
 * naming the wrong one is its own kind of lie. On the delayed package a
 * lagging quote is the entitlement working as sold, so "delayed" is the honest
 * word. On the real-time package there is no standing delay left to blame, so
 * the same lag means the feed has STALLED — and calling that "delayed" would
 * explain away an outage as normal, which is the failure mode this whole
 * disclosure was built to prevent.
 *
 * Both states end by saying the levels are current: the badge is about the
 * price axis, and a trader who reads it as "the levels are stale too" has
 * drawn exactly the wrong conclusion.
 */
export function futuresDelayTitle(symbol: string, ageSeconds: number | null | undefined): string {
  const age = typeof ageSeconds === 'number' && Number.isFinite(ageSeconds) ? ageSeconds : null;
  const exact = age != null ? `about ${Math.round(age / 60)} minutes` : 'an unknown amount';
  const chain = symbol === 'NQ' ? 'NDX' : 'SPX';

  const cause = FUTURES_REALTIME_PENDING
    ? `${symbol} quotes come from a delayed CME feed and are running ${exact} behind the futures market.`
    : `${symbol} quotes are real-time, but the newest print is ${exact} old\u00a0- the feed has stalled rather than fallen behind.`;

  const closing = FUTURES_REALTIME_PENDING
    ? ' Real-time futures data is being enabled\u00a0- this notice will clear itself once it is live.'
    : ' The badge clears itself when the feed recovers.';

  return (
    `${cause} The dealer levels on this page are computed from live ${chain} options ` +
    `and are current.${closing}`
  );
}

/**
 * Whether a `stale` ES / NQ quote means the feed is actually behind.
 *
 * `stale` is measured from the newest print alone, so it cannot tell a feed
 * that stopped from a market that stopped. Once CME closes (the 17:00-18:00 ET
 * daily break, the weekend, a holiday) the last print ages by the minute with
 * nothing wrong: at 20:10 ET on a Friday it is three hours old, and the badge
 * read "~190 MIN DELAY" beside a CLOSED session pill, its tooltip calling the
 * feed stalled. A closed market has nothing to be behind, and `session`
 * follows the CME calendar rather than the feed, so it decides whether the
 * age is news.
 *
 * Fails toward disclosure: only a session that says the market is closed
 * clears the flag. A quote with no session keeps it, so a feed that dies is
 * never hidden by a payload that simply did not say.
 */
export function futuresFeedBehind(
  stale: boolean | null | undefined,
  session: string | null | undefined,
): boolean {
  if (stale !== true) return false;
  return !(typeof session === 'string' && /closed/i.test(session));
}

/**
 * Coarse, human label for a measured feed lag.
 *
 * Rounded to 5-minute buckets on purpose: bar timestamps are start-of-minute,
 * so a healthy-but-delayed feed's age sweeps a full minute every minute. A
 * label rounded to the nearest minute would flip between "10" and "11" while
 * nothing changed, which reads as instability rather than a steady delay.
 */
export function futuresDelayLabel(ageSeconds: number | null | undefined): string {
  if (typeof ageSeconds !== 'number' || !Number.isFinite(ageSeconds)) return 'DELAYED';
  const minutes = ageSeconds / 60;
  if (minutes < 2) return 'DELAYED';
  return `~${Math.max(5, Math.round(minutes / 5) * 5)} MIN DELAY`;
}
