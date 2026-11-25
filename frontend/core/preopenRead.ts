// Today's Read by email, before the open: what the member email SAYS, its
// signed "stop these" link, and how the timer decides who it goes to.
//
// WHY IT EXISTS. Members told us what they leave over: "too much information,
// hard to find the core of it" (app/dashboard/page.tsx), and on Nov 20, 2026 a
// member who left after six days with "Wasn't using it" said a competitor is
// "easier for me to read" — the one whose daily written note lands in every
// subscriber's inbox. The dashboard already writes that read (Today's Read,
// buildReportModel in app/live-bulletin/bulletinHelpers.ts), but only for
// someone who opens the dashboard. This puts the same read, word for word, in
// the inbox before each session, so it earns its keep on the days a member
// never opens the charts.
//
// PURE. No network, no database, no server-only, no '@/' alias: snapshots and
// the read are handed in. scripts/send-preopen-read.mts fetches and sends;
// core/preopenReadRecipients.ts holds the database side; this decides the
// words and is unit-tested without infrastructure (tests/preopenRead.test.ts).

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { DigestModel, SymbolSnapshot } from './dailyLevelsDigest.ts';
import { fmtPrice, fmtNetGex, type ReportModel } from '../app/live-bulletin/bulletinHelpers.ts';

// ── The stop link ───────────────────────────────────────────────────────────
// An HMAC over the member id, namespaced so it is not interchangeable with the
// marketing opt-out (core/unsubToken.ts) or the wall-alert one: stopping this
// email must not unsubscribe anyone from anything else, and the reverse.

function secret(): string {
  const s = process.env.ZEROGEX_END_USER_TOKEN_SECRET;
  if (!s) throw new Error('ZEROGEX_END_USER_TOKEN_SECRET is not set');
  return s;
}

export function preopenReadStopToken(userId: string): string {
  return createHmac('sha256', secret()).update(`preopen-read-stop:v1:${userId}`).digest('base64url');
}

export function verifyPreopenReadStopToken(userId: string | null, token: string | null): boolean {
  if (!userId || !token) return false;
  const expected = Buffer.from(preopenReadStopToken(userId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const PREOPEN_READ_STOP_PATH = '/preopen-read/stop';

export function buildPreopenReadStopUrl(appUrl: string, userId: string): string {
  const base = appUrl.replace(/\/+$/, '');
  return `${base}${PREOPEN_READ_STOP_PATH}?u=${encodeURIComponent(userId)}&t=${preopenReadStopToken(userId)}`;
}

// ── Who the timer sends to ──────────────────────────────────────────────────
// The timer always runs `make preopen-read AUTO=1`, and this decides what that
// means. Until PREOPEN_READ_LIVE=1 is set in frontend/.env.local it mails ONE
// preview to the operator each morning and nothing to members, so the email
// can be read for a week before anyone else gets it. Going live is that one
// line, with no unit to edit and no deploy.

export type PreopenAutoPlan =
  | { mode: 'members' }
  | { mode: 'preview'; to: string }
  | { mode: 'none'; reason: string };

export function resolveAutoPlan(env: Record<string, string | undefined>): PreopenAutoPlan {
  if ((env.PREOPEN_READ_LIVE ?? '').trim() === '1') return { mode: 'members' };
  const to = [env.PREOPEN_READ_PREVIEW_TO, env.CANCELLATION_ALERT_EMAIL, env.SIGNUP_ALARM_EMAIL, env.FOH_REMINDER_EMAIL]
    .map((v) => (v ?? '').trim())
    .find((v) => v.length > 0);
  if (to) return { mode: 'preview', to };
  return {
    mode: 'none',
    reason:
      'PREOPEN_READ_LIVE is not 1 and no preview address is set (PREOPEN_READ_PREVIEW_TO, CANCELLATION_ALERT_EMAIL, SIGNUP_ALARM_EMAIL or FOH_REMINDER_EMAIL).',
  };
}

// ── The model ───────────────────────────────────────────────────────────────

export type PreopenLevel = { label: string; value: string };

export type PreopenRow = {
  symbol: string;
  /** This row's own snapshot time: "8:48 AM" today, "Fri 3:59 PM" earlier. */
  asOf: string;
  spot: string;
  flip: string;
  callWall: string;
  putWall: string;
};

export type PreopenReadModel = {
  symbol: string;
  sessionDate: string;
  /** "Monday". */
  sessionLabel: string;
  subject: string;
  /** One line: where dealers sit, e.g. "Dealers long gamma above the 6,780 flip." */
  heading: string;
  /** The dashboard's Today's Read paragraph, word for word. */
  lead: string;
  /** When the read's own numbers are from, e.g. "Fri 3:59 PM". */
  asOf: string;
  levels: PreopenLevel[];
  rows: PreopenRow[];
  omitted: string[];
  /** True when the rows come from different sessions (ETF options trade pre-market). */
  mixedSessions: boolean;
};

export type BuildPreopenReadInput = {
  /** The free digest's model: the row order, each row's own time, what was omitted. */
  digest: DigestModel;
  /** The same snapshots the digest was built from, for the raw numbers. */
  snapshots: SymbolSnapshot[];
  /** buildReportModel for digest.primary, from its snapshot. */
  report: ReportModel;
};

/**
 * The read's one-line heading. The regime is the dashboard badge's own
 * (detectRegime), so the two never disagree: spot against the flip, or with no
 * flip, the sign of net GEX at spot. A morning with no flip near spot still
 * names the regime; only a snapshot with neither reads as unresolved.
 */
export function preopenHeading(report: Pick<ReportModel, 'regime' | 'gammaFlip'>): string {
  const flip = fmtPrice(report.gammaFlip);
  const hasFlip = report.gammaFlip != null;
  switch (report.regime) {
    case 'positive':
      return hasFlip ? `Dealers long gamma above the ${flip} flip.` : 'Dealers long gamma, with no flip near spot.';
    case 'negative':
      return hasFlip ? `Dealers short gamma below the ${flip} flip.` : 'Dealers short gamma, with no flip near spot.';
    case 'neutral':
      return `Price is sitting on the ${flip} flip.`;
    default:
      return 'The gamma regime is unresolved this morning.';
  }
}

export function buildPreopenRead(input: BuildPreopenReadInput): PreopenReadModel {
  const { digest, report } = input;
  const bySymbol = new Map(input.snapshots.map((s) => [s.symbol, s.data]));
  const primaryRow = digest.rows.find((r) => r.symbol === digest.primary);

  const rows: PreopenRow[] = digest.rows.map((r) => {
    const d = bySymbol.get(r.symbol);
    return {
      symbol: r.symbol,
      asOf: r.asOf,
      spot: fmtPrice(d?.spot_price),
      flip: r.flipUnresolved ? 'unresolved' : fmtPrice(d?.gamma_flip),
      callWall: fmtPrice(d?.call_wall),
      putWall: fmtPrice(d?.put_wall),
    };
  });

  // The levels a reader acts on, in the order the dashboard's strip shows
  // them. A level the snapshot lacks is left out rather than printed as a dash,
  // except the flip: a missing flip says "unresolved", as in the rows below,
  // whether or not net GEX at spot still gave the heading its regime.
  const levels: PreopenLevel[] = [
    { label: 'Gamma flip', value: report.gammaFlip == null ? 'unresolved' : fmtPrice(report.gammaFlip) },
    { label: 'Call wall', value: fmtPrice(report.callWall) },
    { label: 'Put wall', value: fmtPrice(report.putWall) },
    { label: 'Pin strike', value: fmtPrice(report.pinStrike) },
    { label: 'Max pain', value: fmtPrice(report.maxPain) },
    { label: 'Net GEX', value: fmtNetGex(report.netGex) },
  ].filter((l) => l.value !== '—');

  const heading = preopenHeading(report);
  const sessionDates = new Set(digest.rows.map((r) => r.sessionDate));

  return {
    symbol: digest.primary,
    sessionDate: digest.sessionDate,
    sessionLabel: digest.sessionLabel,
    subject: `Today's Read · ${digest.primary}: ${heading.replace(/\.$/, '')}`,
    heading,
    lead: report.lead,
    asOf: primaryRow?.asOf ?? '',
    levels,
    rows,
    omitted: digest.omitted,
    mixedSessions: sessionDates.size > 1,
  };
}

// ── Rendering ───────────────────────────────────────────────────────────────

export type RenderedPreopenRead = { subject: string; text: string; html: string };

export type RenderPreopenReadOptions = {
  stopUrl: string;
  siteUrl: string;
  /**
   * The member's first one. It opens by saying what this is and that one click
   * stops it: a new daily email arriving unannounced is how a product email
   * earns a spam complaint.
   */
  firstSend: boolean;
};

export const PREOPEN_FIRST_SEND_NOTE =
  "New for members: Today's Read, in your inbox before the open on every trading day. It is the same read your dashboard shows. If it's not for you, the link at the bottom turns it off.";

export const PREOPEN_DISCLOSURE =
  'Dealer positioning is modeled from open interest, not observed. Decision-support context, not investment advice.';

const MIXED_SESSIONS_NOTE =
  'Each row shows when its numbers are from: SPY and QQQ options trade before the open, the index options do not.';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderPreopenReadEmail(model: PreopenReadModel, opts: RenderPreopenReadOptions): RenderedPreopenRead {
  const site = opts.siteUrl.replace(/\/+$/, '');
  const dashboardUrl = `${site}/dashboard`;
  const kicker = `Today's Read · ${model.symbol} · before ${model.sessionLabel}'s open`;
  const levelsTitle = `${model.symbol} levels${model.asOf ? `, as of ${model.asOf} ET` : ''}`;
  const omittedNote = model.omitted.length
    ? `Not included this morning (no current snapshot): ${model.omitted.join(', ')}.`
    : null;
  const labelWidth = Math.max(...model.levels.map((l) => l.label.length), 0);
  const asOfWidth = Math.max(...model.rows.map((r) => r.asOf.length), 0);

  const text = [
    kicker,
    '',
    ...(opts.firstSend ? [PREOPEN_FIRST_SEND_NOTE, ''] : []),
    model.heading,
    '',
    model.lead,
    '',
    `${levelsTitle}:`,
    ...model.levels.map((l) => `  ${l.label.padEnd(labelWidth)}  ${l.value}`),
    '',
    'All six:',
    ...model.rows.map(
      (r) =>
        `  ${r.symbol.padEnd(4)} ${r.asOf.padEnd(asOfWidth)}  spot ${r.spot}  flip ${r.flip}  call wall ${r.callWall}  put wall ${r.putWall}`,
    ),
    ...(model.mixedSessions ? [MIXED_SESSIONS_NOTE] : []),
    ...(omittedNote ? [omittedNote] : []),
    '',
    `Open your dashboard: ${dashboardUrl}`,
    '',
    PREOPEN_DISCLOSURE,
    `You're getting this as a ZeroGEX member. Stop these morning emails: ${opts.stopUrl}`,
  ].join('\n');

  const th = 'padding:0 10px 7px 0; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:#6b7680; text-align:left;';
  const td = 'padding:6px 10px 6px 0; border-top:1px solid #eef1f4; white-space:nowrap;';
  const levelsHtml = model.levels
    .map(
      (l) =>
        `<tr><td style="padding:5px 18px 5px 0; color:#6b7680; font-size:13px;">${escapeHtml(l.label)}</td><td style="padding:5px 0; font-size:15px; font-weight:600; color:#12283c; font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(l.value)}</td></tr>`,
    )
    .join('');
  const rowsHtml = model.rows
    .map(
      (r) => `
          <tr>
            <td style="${td} font-weight:700; color:#12283c;">${escapeHtml(r.symbol)}</td>
            <td style="${td}">${escapeHtml(r.spot)}</td>
            <td style="${td}">${escapeHtml(r.flip)}</td>
            <td style="${td}">${escapeHtml(r.callWall)}</td>
            <td style="${td}">${escapeHtml(r.putWall)}</td>
            <td style="${td} color:#6b7680;">${escapeHtml(r.asOf)}</td>
          </tr>`,
    )
    .join('');
  const note = (s: string) => `<p style="margin:10px 0 0; font-size:12px; color:#6b7680;">${escapeHtml(s)}</p>`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; color:#1a1a1a; max-width:640px; margin:0 auto; padding:24px; line-height:1.55;">
      <p style="margin:0 0 14px; font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#8a6100;">${escapeHtml(kicker)}</p>
      ${
        opts.firstSend
          ? `<p style="margin:0 0 18px; padding:12px 14px; background:#fff8e1; border-left:3px solid #f5b400; font-size:14px; color:#3a4650;">${escapeHtml(PREOPEN_FIRST_SEND_NOTE)}</p>`
          : ''
      }
      <h1 style="margin:0 0 12px; font-size:22px; line-height:1.3; color:#12283c;">${escapeHtml(model.heading)}</h1>
      <p style="margin:0 0 22px; font-size:16px; color:#2a3640;">${escapeHtml(model.lead)}</p>

      <p style="margin:0 0 6px; font-size:12px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#6b7680;">${escapeHtml(levelsTitle)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin:0 0 24px;">${levelsHtml}</table>

      <p style="margin:0 0 8px; font-size:12px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#6b7680;">All six</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:13px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#1a1a1a;">
        <thead>
          <tr>
            <th style="${th}">Sym</th><th style="${th}">Spot</th><th style="${th}">Flip</th><th style="${th}">Call wall</th><th style="${th}">Put wall</th><th style="${th}">As of</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}
        </tbody>
      </table>
      ${model.mixedSessions ? note(MIXED_SESSIONS_NOTE) : ''}
      ${omittedNote ? note(omittedNote) : ''}

      <p style="margin:26px 0 0;"><a href="${escapeHtml(dashboardUrl)}" style="display:inline-block; padding:11px 20px; background:#f5b400; color:#000; font-weight:600; text-decoration:none; border-radius:8px; font-size:14px;">Open your dashboard</a></p>

      <p style="margin:28px 0 0; padding-top:14px; border-top:1px solid #eef1f4; font-size:12px; color:#6b7680;">${escapeHtml(PREOPEN_DISCLOSURE)}<br>You&rsquo;re getting this as a ZeroGEX member. <a href="${escapeHtml(opts.stopUrl)}" style="color:#6b7680;">Stop these morning emails</a></p>
    </div>
  `.trim();

  return { subject: model.subject, text, html };
}
