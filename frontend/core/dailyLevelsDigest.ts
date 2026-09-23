// Builds the free pre-open levels digest: the model, the subject line, and
// both rendered bodies.
//
// PURE. No network, no database, no server-only, no '@/' alias — snapshots are
// handed in. scripts/send-daily-levels.mts does the fetching and the sending;
// everything about what the email SAYS is decided here and unit-tested without
// infrastructure (tests/dailyLevelsDigest.test.ts).
//
// It reuses core/gexSummary.ts's formatters rather than writing its own, which
// is the whole reason that module is documented as "pure … safe anywhere": a
// level printed in this email and the same level printed on
// /spx-gamma-levels come out of one function, so the two can never disagree.
// A reader who cross-checks the email against the page is the likeliest
// reader we have, and they must find the same numbers.

import { fmtNetGex, fmtPrice, fmtTimestampET, type GexSummary } from './gexSummary.ts';
import { trackRecordOneLiner, type HistorySummary } from './trackRecord.ts';
import { netGexAtSpotOrNull } from './gammaRegime.ts';
import { etParts, type FreshnessBasis } from './levelsEmail.ts';
import { SYMBOLS } from './symbols.ts';

export type SymbolSnapshot = { symbol: string; data: GexSummary | null };

export type DigestRow = {
  symbol: string;
  /** The subscriber's chosen ticker: leads the table and the paste block. */
  isPrimary: boolean;
  /**
   * This row's OWN snapshot time, short form — "8:48 AM" when it is from the
   * session being named, "Mon 3:59 PM" when it is from an earlier one.
   *
   * Per row, not per email, because the six tickers genuinely disagree before
   * the open: ETF options (SPY, QQQ) trade pre-market and refresh, while index
   * options (SPX, NDX) do not, and the futures inherit the index. Forcing one
   * timestamp onto all six means either dropping the fresh ones or mislabelling
   * them, and the first version of this did the former — it dropped SPY and
   * QQQ every morning for the crime of being newer than SPX.
   */
  asOf: string;
  /** ET calendar date this row's snapshot came from. */
  sessionDate: string;
  /** True when the flip resolver found no qualifying crossing. */
  flipUnresolved: boolean;
  spot: string;
  flip: string;
  callWall: string;
  putWall: string;
  maxPain: string;
  netGex: string;
};

export type DigestModel = {
  /** ET session the digest is FOR — the one about to trade. */
  sessionDate: string;
  /** "Monday", for the subject and the opening line. */
  sessionLabel: string;
  /** Whether the numbers come from that session or the one before it. */
  basis: FreshnessBasis;
  /** The snapshot's own ET wall-clock stamp, e.g. "Sep 18, 2026, 3:59 PM EDT". */
  asOf: string;
  /** Ticker the subject leads with. */
  primary: string;
  rows: DigestRow[];
  /** Symbols dropped because their snapshot was from a different session. */
  omitted: string[];
  subject: string;
  /**
   * One line of graded track record, or null.
   *
   * Optional by design. The send script fetches the archive best-effort, and
   * if that call fails the line is simply absent — a daily cron that mails
   * real subscribers must not acquire a new way to fail in order to carry a
   * marketing sentence.
   */
  trackRecord: string | null;
};

// Fallback reading order, used when a subscriber expressed no preference.
// SPX leads because that is what the search demand behind these pages is
// about. Derived from SYMBOLS rather than rewritten, the same way
// core/llmsTxt.ts does it, so a seventh ingested ticker appears here without
// an edit instead of being silently dropped from every digest.
const PREFERRED_ORDER = ['SPX', 'SPY', 'QQQ', 'NDX', 'ES', 'NQ'] as const;
export const DIGEST_SYMBOL_ORDER: readonly string[] = [
  ...PREFERRED_ORDER.filter((s) => (SYMBOLS as readonly string[]).includes(s)),
  ...SYMBOLS.filter((s) => !(PREFERRED_ORDER as readonly string[]).includes(s)),
];

/**
 * The reading order for one subscriber: their symbol first, then the rest in
 * the canonical order.
 *
 * Mirrors what gammaLevels.tsx already does for the ticker pages ("Primary
 * symbol first, then the remaining three in their canonical order") so the
 * email a QQQ reader gets is laid out like the QQQ page they subscribed from.
 */
export function digestOrderFor(primary: string): readonly string[] {
  if (!DIGEST_SYMBOL_ORDER.includes(primary)) return DIGEST_SYMBOL_ORDER;
  return [primary, ...DIGEST_SYMBOL_ORDER.filter((s) => s !== primary)];
}

function weekdayName(isoDate: string): string {
  const dt = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(dt.getTime())) return 'the next';
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(dt);
}

/** "8:48 AM" for the session being named; "Mon 3:59 PM" for an earlier one. */
function shortAsOf(timestamp: string, sessionDate: string): string {
  const d = new Date(timestamp);
  const rowDate = etParts(d).date;
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(d);
  if (rowDate === sessionDate) return time;
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short',
  }).format(d);
  return `${weekday} ${time}`;
}

function toRow(symbol: string, d: GexSummary, isPrimary: boolean, sessionDate: string): DigestRow {
  return {
    symbol,
    isPrimary,
    asOf: shortAsOf(d.timestamp, sessionDate),
    sessionDate: etParts(new Date(d.timestamp)).date,
    flipUnresolved: fmtPrice(d.gamma_flip) === '—',
    spot: fmtPrice(d.spot_price),
    flip: fmtPrice(d.gamma_flip),
    callWall: fmtPrice(d.call_wall),
    putWall: fmtPrice(d.put_wall),
    maxPain: fmtPrice(d.max_pain),
    netGex: fmtNetGex(netGexAtSpotOrNull(d.net_gex_at_spot) ?? d.net_gex),
  };
}

export type BuildDigestInput = {
  snapshots: SymbolSnapshot[];
  /** ET session the digest is about, from checkSendWindow. */
  sessionDate: string;
  /** Which session the primary's snapshot came from, from checkFreshness. */
  basis: FreshnessBasis;
  /** Ticker the subject leads with. Defaults to SPX. */
  primary?: string;
  /**
   * The graded forecast record for `primary`, when the caller could fetch it.
   * Passed in rather than fetched here so this module stays pure.
   */
  history?: HistorySummary | null;
};

/**
 * Assemble the model, or null when there is nothing honest to send.
 *
 * ONE EMAIL, ONE SNAPSHOT DATE. Every row must come from the same session as
 * the primary's; a symbol whose snapshot is from a different date is dropped
 * and named rather than printed beside the others. The levels pages already
 * treat a lagging ticker as a thing to flag (STALE_THRESHOLD_MS in
 * gammaLevels.tsx) — in an email, where there is no badge to read and no page
 * to refresh, the only safe version of that is to leave the row out.
 *
 * Returns null when the primary has no usable snapshot. The caller aborts the
 * whole send rather than mailing a digest missing the ticker it is named
 * after.
 */
export function buildDigestModel(input: BuildDigestInput): DigestModel | null {
  const primary = input.primary ?? 'SPX';
  const bySymbol = new Map(input.snapshots.map((s) => [s.symbol, s.data]));

  const primaryData = bySymbol.get(primary);
  if (!primaryData?.timestamp) return null;

  // EVERY ticker with a snapshot is included, each stamped with its own time.
  //
  // This replaces an anchor rule that dropped any row whose session did not
  // match the primary's. It was written to keep a STALE ticker out of a fresh
  // table, but before the open the six genuinely disagree — ETF options refresh
  // pre-market, index options do not — so in practice it dropped SPY and QQQ
  // from every SPX-led digest for being NEWER than the anchor, and dropped four
  // of six from a SPY-led one. Two subscribers on the same morning received
  // materially different emails.
  //
  // Freshness is already decided before this function is called: the send
  // script runs checkFreshness() per symbol and passes null for anything that
  // failed. So a row reaching here is one we are entitled to print; the job is
  // to say WHEN it is from, not to guess which ones belong together.
  const rows: DigestRow[] = [];
  const omitted: string[] = [];
  for (const symbol of digestOrderFor(primary)) {
    const data = bySymbol.get(symbol);
    if (!data?.timestamp) {
      if (symbol !== primary) omitted.push(symbol);
      continue;
    }
    rows.push(toRow(symbol, data, symbol === primary, input.sessionDate));
  }

  if (rows.length === 0) return null;

  const sessionLabel = weekdayName(input.sessionDate);
  const primaryRow = rows.find((r) => r.symbol === primary);
  // Subject leads with the two levels a reader acts on first. Each term is
  // appended only if it exists, so an incomplete snapshot shortens the line
  // rather than printing an em dash where a number should be.
  const parts = [`${primary} gamma map for ${sessionLabel}`];
  if (primaryRow && primaryRow.flip !== '—') parts.push(`flip ${primaryRow.flip}`);
  if (primaryRow && primaryRow.callWall !== '—') parts.push(`call wall ${primaryRow.callWall}`);

  return {
    sessionDate: input.sessionDate,
    sessionLabel,
    basis: input.basis,
    asOf: fmtTimestampET(primaryData.timestamp),
    primary,
    rows,
    omitted,
    subject: parts.join(' · '),
    // Null unless the caller supplied an archive deep enough to say something
    // honest; trackRecordOneLiner falls back to the practice sentence on a
    // thin record, and there is no point spending a line of a daily email on
    // a sentence carrying no number.
    trackRecord: input.history ? trackRecordOneLiner(input.history, primary) : null,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The provenance line.
 *
 * A pre-open map is computed from the prior close's chain, because until the
 * new session trades there is no newer chain to compute from. That is normal
 * and it is what the product is — but the reader must be told, in the same
 * breath as the numbers, or the first time they cross-check against
 * /spx-gamma-levels they will conclude the email is stale rather than dated.
 *
 * MIXED SESSIONS ARE THE COMMON CASE, not an error. Before the open, ETF
 * options (SPY, QQQ) have already refreshed while index options (SPX, NDX)
 * have not, and the futures inherit the index. Saying so is more expert than
 * hiding it: a reader who knows index options do not trade pre-market will
 * recognise a product that knows it too. Deliberately phrased without naming
 * which tickers are which, so it stays true if the ingestion changes.
 */
function provenance(model: DigestModel): string {
  const sessions = new Set(model.rows.map((r) => r.sessionDate));
  if (sessions.size > 1) {
    return 'Index options do not trade pre-market, so some levels below carry the previous close while others have already updated this morning. Each row is stamped with its own snapshot time. All levels delayed ~15 minutes.';
  }
  return model.basis === 'prior-session'
    ? `Computed from the previous session's closing options chain. As of ${model.asOf} · delayed ~15 minutes.`
    : `As of ${model.asOf} · delayed ~15 minutes.`;
}

// The em dash fmtPrice returns for a missing level is right for the human
// table and WRONG here. This block exists to be typed into the free
// TradingView script's four numeric inputs, and "flip —" is not a number.
// The script's own convention for an absent level is 0 ("Set any level to 0
// to hide it" — docs/tradingview-indicator.md), so that is what a missing
// level becomes. Found against live data: NDX and NQ published no gamma flip
// on 2026-09-21 and the block shipped an em dash into a numeric field.
const PASTE_MISSING = '0';

function pasteValue(formatted: string): string {
  return formatted === '—' ? PASTE_MISSING : formatted;
}

function pasteLine(row: DigestRow): string {
  return (
    `${row.symbol}: flip ${pasteValue(row.flip)}` +
    ` / call wall ${pasteValue(row.callWall)}` +
    ` / put wall ${pasteValue(row.putWall)}` +
    ` / max pain ${pasteValue(row.maxPain)}`
  );
}

/** True when any pasted level fell back to 0, so the note can explain it. */
function hasMissingPasteLevel(rows: DigestRow[]): boolean {
  return rows.some((r) => [r.flip, r.callWall, r.putWall, r.maxPain].includes('—'));
}

const PASTE_ZERO_NOTE =
  'A 0 means no level was published for that ticker today — the script hides any level set to 0.';

/**
 * What the asterisk beside a missing gamma flip means.
 *
 * Deliberately borrowed from content/methodology.md, which already states the
 * policy: "When the option chain is too degraded for the flip resolver to find
 * a qualifying crossing, ZeroGEX reports the flip as unresolved ... rather than
 * fabricating an edge value or silently carrying forward a stale one."
 *
 * Worth an asterisk rather than a bare em dash because the two read completely
 * differently to a trader: a blank looks like a data outage, whereas "we
 * refused to print a number we cannot stand behind" is a reason to trust the
 * other five columns more, not less.
 */
const FLIP_UNRESOLVED_NOTE =
  '* Gamma flip unresolved — the chain had no qualifying zero-crossing, so no level is printed rather than an invented one.';
const FLIP_UNRESOLVED_PATH = '/methodology';

/**
 * The reading list at the foot of every digest.
 *
 * Every one of these is a public page needing no account, and each answers a
 * question the email itself raises: what the numbers mean, how they are
 * computed, and whether the engine's calls actually work out. /scorecard is
 * here deliberately — the September Search Console review found it had "no
 * entry point at all: dated permalinks, no sidebar entry, no inbound link",
 * and a daily email to engaged readers is the best inbound link it will get.
 */
const FOOTER_LINKS: ReadonlyArray<{ path: string; label: string; blurb: string }> = [
  { path: '/methodology', label: 'Methodology', blurb: 'how every level here is computed, and what it cannot tell you' },
  { path: '/education/how-to-read-a-gamma-flip', label: 'How to read a gamma flip', blurb: 'the line the whole map hangs on' },
  { path: '/education/gamma-walls-explained', label: 'Gamma walls explained', blurb: 'why price stalls at the call and put walls' },
  { path: '/scorecard', label: 'Daily Scorecard', blurb: "how the engine's calls actually resolved, session by session" },
  { path: '/track-record', label: 'Forecast track record', blurb: 'every graded session since we started, including the days the range broke' },
  { path: '/tradingview-indicator', label: 'Free TradingView script', blurb: 'plot the levels above on your own chart' },
];

export type RenderedEmail = { subject: string; text: string; html: string };

export function renderDailyLevelsEmail(
  model: DigestModel,
  opts: { unsubUrl: string; siteUrl: string },
): RenderedEmail {
  const site = opts.siteUrl.replace(/\/+$/, '');
  const omittedNote = model.omitted.length
    ? `Not included this morning (no matching snapshot): ${model.omitted.join(', ')}.`
    : '';

  const zeroNote = hasMissingPasteLevel(model.rows) ? PASTE_ZERO_NOTE : null;
  const anyFlipUnresolved = model.rows.some((r) => r.flipUnresolved);
  // Widest stamp in this digest, so the columns line up whether every row is
  // "8:48 AM" or a mix with "Mon 3:59 PM".
  const asOfWidth = Math.max(...model.rows.map((r) => r.asOf.length));
  const flipCell = (r: DigestRow) => `${r.flip}${r.flipUnresolved ? '*' : ''}`;

  const text = [
    `Dealer positioning for ${model.sessionLabel}'s session.`,
    provenance(model),
    '',
    ...model.rows.map(
      (r) =>
        `${r.symbol.padEnd(4)} ${r.asOf.padEnd(asOfWidth)}  spot ${r.spot}  flip ${flipCell(r)}  call wall ${r.callWall}  put wall ${r.putWall}  max pain ${r.maxPain}  net GEX ${r.netGex}`,
    ),
    anyFlipUnresolved ? '' : null,
    anyFlipUnresolved ? `${FLIP_UNRESOLVED_NOTE} ${site}${FLIP_UNRESOLVED_PATH}` : null,
    '',
    // Both entries drop out when nothing was omitted, rather than leaving the
    // empty string behind as a second blank line.
    omittedNote || null,
    omittedNote ? '' : null,
    'Paste order for the free TradingView script (Gamma Flip / Call Wall / Put Wall / Max Pain):',
    zeroNote,
    ...model.rows.map(pasteLine),
    '',
    `Full page, charts and the other tickers: ${site}/spx-gamma-levels`,
    '',
    'Worth reading:',
    ...(model.trackRecord
      ? [`${model.trackRecord}`, `  ${site}/track-record`, '']
      : []),
    ...FOOTER_LINKS.map((l) => `  ${l.label} — ${l.blurb}\n    ${site}${l.path}`),
    '',
    `Live intraday levels, dealer flow and signals are what the paid plans add. Start with a 7-day free trial on Basic (no charge until the trial ends), or pick any other plan with a 7-day money-back guarantee: ${site}/pricing`,
    '',
    '---',
    `Unsubscribe: ${opts.unsubUrl}`,
  ]
    .filter((line) => line !== null)
    .join('\n');

  // The subscriber's own ticker is tinted and left-ruled rather than merely
  // bolded: every symbol cell is already bold, so weight alone would not
  // distinguish it. Inline styles only — Gmail strips <style> blocks, so a
  // class-based highlight would simply not appear.
  const rowsHtml = model.rows
    .map(
      (r) => `
        <tr${r.isPrimary ? ' style="background:#f3f8fb;"' : ''}>
          <td style="padding:7px 10px 7px 0; font-weight:700; color:#12283c; white-space:nowrap;${r.isPrimary ? ' border-left:3px solid #f5b400; padding-left:9px;' : ''}">
            ${escapeHtml(r.symbol)}<br><span style="font-weight:400; font-size:10.5px; color:#8a939b;">${escapeHtml(r.asOf)}</span>
          </td>
          <td style="padding:7px 10px; color:#3a4650; white-space:nowrap;">${escapeHtml(r.spot)}</td>
          <td style="padding:7px 10px; color:#3a4650; white-space:nowrap;">${escapeHtml(r.flip)}${r.flipUnresolved ? '<span style="color:#b0761a;">*</span>' : ''}</td>
          <td style="padding:7px 10px; color:#3a4650; white-space:nowrap;">${escapeHtml(r.callWall)}</td>
          <td style="padding:7px 10px; color:#3a4650; white-space:nowrap;">${escapeHtml(r.putWall)}</td>
          <td style="padding:7px 10px; color:#3a4650; white-space:nowrap;">${escapeHtml(r.maxPain)}</td>
          <td style="padding:7px 0 7px 10px; color:#3a4650; white-space:nowrap;">${escapeHtml(r.netGex)}</td>
        </tr>`,
    )
    .join('');

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; color:#1a1a1a; max-width:640px; margin:0 auto; padding:24px; line-height:1.5;">
      <p style="margin:0 0 4px; font-size:17px; font-weight:700; color:#12283c;">Dealer positioning for ${escapeHtml(model.sessionLabel)}&rsquo;s session</p>
      <p style="margin:0 0 18px; font-size:12px; color:#6b7680;">${escapeHtml(provenance(model))}</p>

      ${
        /*
         * Today's levels card for the subscriber's own ticker.
         *
         * /embed/image/<SYMBOL>.png is the PUBLIC, free-tier card the widget
         * already serves — a Next ImageResponse route, no auth, no token, no
         * headless browser in the send path. Deliberately NOT the Live
         * Bulletin snapshot: that screenshots the same GammaReportCard the
         * Basic-gated /live-bulletin page renders, so mailing it would give
         * away every morning exactly what the last line of this email is
         * asking the reader to buy.
         *
         * Everything the image shows is repeated as text below it, because
         * most clients block images by default and Gmail proxies the rest.
         * The digest must read correctly with the picture missing.
         */ ''
      }
      <a href="${escapeHtml(`${site}/${model.primary.toLowerCase()}-gamma-levels`)}" style="display:block; margin:0 0 20px;">
        <img src="${escapeHtml(`${site}/embed/image/${model.primary}.png`)}"
             alt="${escapeHtml(`${model.primary} gamma levels — gamma flip, call wall, put wall`)}"
             width="600" style="width:100%; max-width:600px; height:auto; border:1px solid #e2e6ea; border-radius:8px; display:block;" />
      </a>

      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:13px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">
        <thead>
          <tr style="border-bottom:1px solid #e2e6ea;">
            <th align="left" style="padding:0 10px 7px 0; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:#6b7680;">Sym</th>
            <th align="left" style="padding:0 10px 7px; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:#6b7680;">Spot</th>
            <th align="left" style="padding:0 10px 7px; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:#6b7680;">Flip</th>
            <th align="left" style="padding:0 10px 7px; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:#6b7680;">Call wall</th>
            <th align="left" style="padding:0 10px 7px; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:#6b7680;">Put wall</th>
            <th align="left" style="padding:0 10px 7px; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:#6b7680;">Max pain</th>
            <th align="left" style="padding:0 0 7px 10px; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:#6b7680;">Net GEX</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}
        </tbody>
      </table>

      ${omittedNote ? `<p style="margin:14px 0 0; font-size:12px; color:#6b7680;">${escapeHtml(omittedNote)}</p>` : ''}
      ${
        anyFlipUnresolved
          ? `<p style="margin:12px 0 0; font-size:12px; color:#6b7680;">${escapeHtml(FLIP_UNRESOLVED_NOTE)} <a href="${escapeHtml(`${site}${FLIP_UNRESOLVED_PATH}`)}" style="color:#12283c; text-decoration:underline;">How the flip is computed &rarr;</a></p>`
          : ''
      }

      <p style="margin:24px 0 6px; font-size:13px; font-weight:700; color:#12283c;">Paste order for the free TradingView script</p>
      <p style="margin:0 0 8px; font-size:12px; color:#6b7680;">Gamma Flip / Call Wall / Put Wall / Max Pain${zeroNote ? ` &middot; ${escapeHtml(zeroNote)}` : ''}</p>
      <pre style="margin:0; padding:14px 16px; background:#f5f7f9; border:1px solid #e2e6ea; border-radius:8px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12.5px; line-height:1.7; color:#12283c; white-space:pre-wrap; word-break:break-word;">${escapeHtml(model.rows.map(pasteLine).join('\n'))}</pre>

      <p style="margin:22px 0 0; font-size:14px;">
        <a href="${escapeHtml(`${site}/spx-gamma-levels`)}" style="color:#12283c; font-weight:600;">Full page, charts and the other tickers &rarr;</a>
      </p>

      <div style="margin:24px 0 0; padding-top:18px; border-top:1px solid #e8e8e8;">
        <p style="margin:0 0 10px; font-size:13px; font-weight:700; color:#12283c;">Worth reading</p>
        ${model.trackRecord
          ? `<p style="margin:0 0 14px; padding:10px 12px; background:#f4f7fa; border-left:3px solid #12283c; font-size:13px; line-height:1.5; color:#12283c;">
              ${escapeHtml(model.trackRecord)}
              <a href="${escapeHtml(`${site}/track-record`)}" style="color:#12283c; font-weight:600;">See the record &rarr;</a>
            </p>`
          : ''}
        ${FOOTER_LINKS.map(
          (l) => `<p style="margin:0 0 7px; font-size:13px; line-height:1.45;">
            <a href="${escapeHtml(`${site}${l.path}`)}" style="color:#12283c; font-weight:600; text-decoration:none;">${escapeHtml(l.label)}</a>
            <span style="color:#6b7680;"> &mdash; ${escapeHtml(l.blurb)}</span>
          </p>`,
        ).join('')}
      </div>

      <p style="margin:20px 0 0; padding-top:18px; border-top:1px solid #e8e8e8; font-size:13px; color:#555;">
        Live intraday levels, dealer flow and signals are what the paid plans add.
        Start with a <a href="${escapeHtml(`${site}/pricing`)}" style="color:#12283c; font-weight:600;">7-day free trial on Basic</a> (no charge until the trial ends), or pick any other plan with a 7-day money-back guarantee.
      </p>

      <p style="margin:18px 0 0; font-size:11px; color:#8a939b;">
        You are receiving this because you confirmed a subscription to the free ZeroGEX daily levels email.
        <a href="${escapeHtml(opts.unsubUrl)}" style="color:#8a939b; text-decoration:underline;">Unsubscribe</a>.
      </p>
    </div>
  `.trim();

  return { subject: model.subject, text, html };
}
