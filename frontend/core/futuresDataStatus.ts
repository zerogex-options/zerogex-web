/**
 * One switch for the ES / NQ market-data disclosure.
 *
 * TradeStation sells CME data as separate delayed and real-time packages. The
 * account is on the DELAYED package while the real-time entitlement is
 * provisioned, so every ES / NQ price on the site — the live terminal quote
 * and the reference spot on the free gamma-levels pages alike — is running
 * roughly 10 minutes behind the futures market. Equities (SPY, QQQ) and the
 * cash indexes (SPX, NDX) are real-time and unaffected, as are the dealer
 * levels themselves, which are computed from the live SPX / NDX option chains
 * and only converted onto the futures price axis.
 *
 * Flip this to false once ES / NQ report sub-minute ages (see Step 1a of
 * docs/runbooks/es_nq_futures_rollout.md in zerogex-oa for the query). That
 * removes the "being enabled" wording everywhere at once.
 *
 * The terminal's delay BADGE is not gated on this — it reads the quote's own
 * `data_age_seconds` and so keeps working afterwards as an honest signal that
 * a real-time feed has stalled. This constant only controls the copy that
 * promises the delay is temporary, plus the static prose on the free pages,
 * which have no live freshness value to read.
 */
export const FUTURES_REALTIME_PENDING = true;

/** Sentence for static, server-rendered pages that cannot measure the lag. */
export function futuresDelayNote(symbol: string): string {
  if (!FUTURES_REALTIME_PENDING) return '';
  return ` ${symbol} prices currently come from a delayed CME feed and can run about 10 minutes further behind while real-time futures data is being enabled; the levels themselves are unaffected.`;
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
