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
import { netGexAtSpotOrNull } from './gammaRegime.ts';
import { etParts, type FreshnessBasis } from './levelsEmail.ts';

export type SymbolSnapshot = { symbol: string; data: GexSummary | null };

export type DigestRow = {
  symbol: string;
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
};

/** Reading order. SPX leads: it is what the search demand is about. */
export const DIGEST_SYMBOL_ORDER = ['SPX', 'SPY', 'QQQ', 'NDX', 'ES', 'NQ'] as const;

function weekdayName(isoDate: string): string {
  const dt = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(dt.getTime())) return 'the next';
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(dt);
}

function toRow(symbol: string, d: GexSummary): DigestRow {
  return {
    symbol,
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

  const anchorDate = etParts(new Date(primaryData.timestamp)).date;
  if (!anchorDate) return null;

  const rows: DigestRow[] = [];
  const omitted: string[] = [];
  for (const symbol of DIGEST_SYMBOL_ORDER) {
    const data = bySymbol.get(symbol);
    if (!data?.timestamp) {
      if (symbol !== primary) omitted.push(symbol);
      continue;
    }
    if (etParts(new Date(data.timestamp)).date !== anchorDate) {
      omitted.push(symbol);
      continue;
    }
    rows.push(toRow(symbol, data));
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
 * The provenance line, and the single most important sentence in the email.
 *
 * A pre-open map is computed from the prior close's chain, because until the
 * new session trades there is no newer chain to compute from. That is normal
 * and it is what the product is — but the reader must be told, in the same
 * breath as the numbers, or the first time they cross-check against
 * /spx-gamma-levels they will conclude the email is stale rather than that it
 * is dated. Naming the source session is what makes it a map of the session
 * ahead instead of an unlabelled repeat of yesterday.
 */
function provenance(model: DigestModel): string {
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

  const text = [
    `Dealer positioning for ${model.sessionLabel}'s session.`,
    provenance(model),
    '',
    ...model.rows.map(
      (r) =>
        `${r.symbol.padEnd(4)} spot ${r.spot}  flip ${r.flip}  call wall ${r.callWall}  put wall ${r.putWall}  max pain ${r.maxPain}  net GEX ${r.netGex}`,
    ),
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
    `Live intraday levels, dealer flow and signals are what the paid plans add — 7-day trial, cancel any time: ${site}/pricing`,
    '',
    '---',
    `Unsubscribe: ${opts.unsubUrl}`,
  ]
    .filter((line) => line !== null)
    .join('\n');

  const rowsHtml = model.rows
    .map(
      (r) => `
        <tr>
          <td style="padding:7px 10px 7px 0; font-weight:700; color:#12283c; white-space:nowrap;">${escapeHtml(r.symbol)}</td>
          <td style="padding:7px 10px; color:#3a4650; white-space:nowrap;">${escapeHtml(r.spot)}</td>
          <td style="padding:7px 10px; color:#3a4650; white-space:nowrap;">${escapeHtml(r.flip)}</td>
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
      <p style="margin:0 0 20px; font-size:12px; color:#6b7680;">${escapeHtml(provenance(model))}</p>

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

      <p style="margin:24px 0 6px; font-size:13px; font-weight:700; color:#12283c;">Paste order for the free TradingView script</p>
      <p style="margin:0 0 8px; font-size:12px; color:#6b7680;">Gamma Flip / Call Wall / Put Wall / Max Pain${zeroNote ? ` &middot; ${escapeHtml(zeroNote)}` : ''}</p>
      <pre style="margin:0; padding:14px 16px; background:#f5f7f9; border:1px solid #e2e6ea; border-radius:8px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12.5px; line-height:1.7; color:#12283c; white-space:pre-wrap; word-break:break-word;">${escapeHtml(model.rows.map(pasteLine).join('\n'))}</pre>

      <p style="margin:22px 0 0; font-size:14px;">
        <a href="${escapeHtml(`${site}/spx-gamma-levels`)}" style="color:#12283c; font-weight:600;">Full page, charts and the other tickers &rarr;</a>
      </p>

      <p style="margin:22px 0 0; padding-top:18px; border-top:1px solid #e8e8e8; font-size:13px; color:#555;">
        Live intraday levels, dealer flow and signals are what the paid plans add.
        <a href="${escapeHtml(`${site}/pricing`)}" style="color:#12283c; font-weight:600;">7-day trial</a>, cancel any time.
      </p>

      <p style="margin:18px 0 0; font-size:11px; color:#8a939b;">
        You are receiving this because you confirmed a subscription to the free ZeroGEX daily levels email.
        <a href="${escapeHtml(opts.unsubUrl)}" style="color:#8a939b; text-decoration:underline;">Unsubscribe</a>.
      </p>
    </div>
  `.trim();

  return { subject: model.subject, text, html };
}
