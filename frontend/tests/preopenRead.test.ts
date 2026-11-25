import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Today's Read by email before the open: the words (core/preopenRead.ts), the
// stop link, the timer's preview-until-live switch, and who gets it
// (core/preopenReadRecipients.ts, against the real schema).

process.env.ZEROGEX_END_USER_TOKEN_SECRET = 'test-secret-preopen';
const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zgx-preopen-read-')), 'auth.db');
process.env.AUTH_DB_PATH = dbPath;

const {
  buildPreopenRead,
  buildPreopenReadStopUrl,
  preopenHeading,
  preopenReadStopToken,
  renderPreopenReadEmail,
  resolveAutoPlan,
  verifyPreopenReadStopToken,
  PREOPEN_FIRST_SEND_NOTE,
} = await import('../core/preopenRead.ts');
const { buildDigestModel } = await import('../core/dailyLevelsDigest.ts');
const { buildReportModel } = await import('../app/live-bulletin/bulletinHelpers.ts');
const { unsubToken } = await import('../core/unsubToken.ts');
const { getDb } = await import('../core/db.ts');
const { listPreopenReadRecipients, markPreopenReadSent, stopPreopenRead } = await import(
  '../core/preopenReadRecipients.ts'
);

// ── A Monday morning: SPX from Friday's close, SPY refreshed pre-market ─────
const SESSION = '2026-11-23';
const FRIDAY_CLOSE = '2026-11-20T20:59:00.000Z';
const MONDAY_PREMARKET = '2026-11-23T13:40:00.000Z';

function summary(symbol: string, timestamp: string, over: Record<string, unknown> = {}) {
  return {
    timestamp,
    symbol,
    spot_price: 6812.4,
    total_call_gex: 6.1e9,
    total_put_gex: -4.4e9,
    net_gex: 1.7e9,
    net_gex_at_spot: 1.32e9,
    gamma_flip: 6780,
    max_pain: 6800,
    call_wall: 6900,
    put_wall: 6700,
    put_call_ratio: 1.1,
    pin_strike: 6825,
    ...over,
  };
}

const snapshots = [
  { symbol: 'SPX', data: summary('SPX', FRIDAY_CLOSE) },
  { symbol: 'SPY', data: summary('SPY', MONDAY_PREMARKET, { spot_price: 680.12, gamma_flip: 677, call_wall: 690, put_wall: 670, max_pain: 680, pin_strike: null }) },
  { symbol: 'QQQ', data: null },
  { symbol: 'NDX', data: summary('NDX', FRIDAY_CLOSE, { spot_price: 25123.4, gamma_flip: 24900, call_wall: 25500, put_wall: 24500 }) },
  { symbol: 'ES', data: summary('ES', FRIDAY_CLOSE, { spot_price: 6851.25, gamma_flip: 6819, call_wall: 6939, put_wall: 6739 }) },
  { symbol: 'NQ', data: summary('NQ', FRIDAY_CLOSE, { spot_price: 25311.5, gamma_flip: 25088, call_wall: 25688, put_wall: 24688 }) },
];

function modelFor(spxOver: Record<string, unknown> = {}) {
  const snaps = snapshots.map((s) => (s.symbol === 'SPX' ? { symbol: 'SPX', data: summary('SPX', FRIDAY_CLOSE, spxOver) } : s));
  const digest = buildDigestModel({ snapshots: snaps, sessionDate: SESSION, basis: 'prior-session', primary: 'SPX' });
  assert.ok(digest);
  const spx = snaps[0].data!;
  const report = buildReportModel({
    symbol: 'SPX', spot: spx.spot_price, priorClose: null, summary: spx, vix: null, volIndex: 'VIX', horizon: 'daily',
  });
  return { model: buildPreopenRead({ digest, snapshots: snaps, report }), report };
}

// ── The stop link ───────────────────────────────────────────────────────────

test('stop link: signed per member, and not interchangeable with the marketing opt-out', () => {
  const token = preopenReadStopToken('user_1');
  assert.equal(verifyPreopenReadStopToken('user_1', token), true);
  assert.equal(verifyPreopenReadStopToken('user_2', token), false);
  assert.equal(verifyPreopenReadStopToken('user_1', `${token}x`), false);
  assert.equal(verifyPreopenReadStopToken(null, token), false);
  assert.equal(verifyPreopenReadStopToken('user_1', null), false);
  // A marketing unsubscribe link must not stop this email, nor the reverse.
  assert.equal(verifyPreopenReadStopToken('user_1', unsubToken('user_1')), false);
  assert.notEqual(token, unsubToken('user_1'));

  const url = new URL(buildPreopenReadStopUrl('https://zerogex.io/', 'user_1'));
  assert.equal(url.origin + url.pathname, 'https://zerogex.io/preopen-read/stop');
  assert.equal(url.searchParams.get('u'), 'user_1');
  assert.equal(verifyPreopenReadStopToken(url.searchParams.get('u'), url.searchParams.get('t')), true);
});

// ── The timer: a preview a morning until it is switched on ──────────────────

test('auto plan: members only with PREOPEN_READ_LIVE=1, otherwise one preview to the operator', () => {
  assert.deepEqual(resolveAutoPlan({ PREOPEN_READ_LIVE: '1', CANCELLATION_ALERT_EMAIL: 'ops@example.com' }), { mode: 'members' });
  assert.deepEqual(resolveAutoPlan({ PREOPEN_READ_LIVE: ' 1 ' }), { mode: 'members' });
  // Anything but exactly 1 stays in preview.
  for (const live of [undefined, '', '0', 'true', 'yes']) {
    assert.deepEqual(resolveAutoPlan({ PREOPEN_READ_LIVE: live, SIGNUP_ALARM_EMAIL: 'alarm@example.com' }), {
      mode: 'preview',
      to: 'alarm@example.com',
    });
  }
  // The dedicated address wins, then the usual operator chain in order.
  assert.deepEqual(
    resolveAutoPlan({ PREOPEN_READ_PREVIEW_TO: 'me@example.com', CANCELLATION_ALERT_EMAIL: 'ops@example.com' }),
    { mode: 'preview', to: 'me@example.com' },
  );
  assert.deepEqual(resolveAutoPlan({ CANCELLATION_ALERT_EMAIL: 'ops@example.com', FOH_REMINDER_EMAIL: 'foh@example.com' }), {
    mode: 'preview',
    to: 'ops@example.com',
  });
  // Nowhere to send a preview: nothing at all, never members.
  assert.equal(resolveAutoPlan({}).mode, 'none');
});

// ── The words ───────────────────────────────────────────────────────────────

test('heading: where dealers sit, by the same rule as the dashboard badge', () => {
  assert.equal(preopenHeading({ regime: 'positive', gammaFlip: 6780 }), 'Dealers long gamma above the 6,780 flip.');
  assert.equal(preopenHeading({ regime: 'negative', gammaFlip: 6780 }), 'Dealers short gamma below the 6,780 flip.');
  assert.equal(preopenHeading({ regime: 'neutral', gammaFlip: 6780 }), 'Price is sitting on the 6,780 flip.');
  // No flip near spot: the regime came off net GEX at spot. Named plainly, never
  // "below the — flip".
  assert.equal(preopenHeading({ regime: 'positive', gammaFlip: null }), 'Dealers long gamma, with no flip near spot.');
  assert.equal(preopenHeading({ regime: 'negative', gammaFlip: null }), 'Dealers short gamma, with no flip near spot.');
  assert.equal(preopenHeading({ regime: 'unresolved', gammaFlip: null }), 'The gamma regime is unresolved this morning.');
});

test("the read is the dashboard's Today's Read, word for word, with its levels", () => {
  const { model, report } = modelFor();
  assert.equal(model.lead, report.lead);
  assert.equal(model.subject, "Today's Read · SPX: Dealers long gamma above the 6,780 flip");
  assert.equal(model.heading, 'Dealers long gamma above the 6,780 flip.');
  assert.equal(model.sessionLabel, 'Monday');
  assert.equal(model.asOf, 'Fri 3:59 PM');
  assert.deepEqual(
    model.levels.map((l) => `${l.label}=${l.value}`),
    ['Gamma flip=6,780', 'Call wall=6,900', 'Put wall=6,700', 'Pin strike=6,825', 'Max pain=6,800', 'Net GEX=+$1.32B'],
  );
});

test('every row is printed with its own time, and a missing ticker is named, not faked', () => {
  const { model } = modelFor();
  assert.deepEqual(model.rows.map((r) => r.symbol), ['SPX', 'SPY', 'NDX', 'ES', 'NQ']);
  assert.deepEqual(model.omitted, ['QQQ']);
  const spy = model.rows.find((r) => r.symbol === 'SPY')!;
  assert.equal(spy.asOf, '8:40 AM');
  assert.equal(spy.spot, '680.12');
  assert.equal(model.rows.find((r) => r.symbol === 'NDX')!.flip, '24,900');
  // SPY refreshed this morning and SPX did not: the email says why they differ.
  assert.equal(model.mixedSessions, true);
});

test('a level the snapshot lacks is left out, and an unresolved flip says so', () => {
  // Net GEX at spot is still +$1.32B here, so the heading names the regime;
  // the flip itself still reads "unresolved", as in the rows.
  const { model } = modelFor({ pin_strike: null, gamma_flip: null });
  assert.equal(model.heading, 'Dealers long gamma, with no flip near spot.');
  assert.ok(!model.levels.some((l) => l.label === 'Pin strike'));
  assert.equal(model.levels.find((l) => l.label === 'Gamma flip')!.value, 'unresolved');
  assert.equal(model.rows.find((r) => r.symbol === 'SPX')!.flip, 'unresolved');
  assert.ok(!model.levels.some((l) => l.value === '—'));
});

// The 2026-11-25 morning: no flip, and net GEX at spot clearly negative. The
// heading is the dashboard's regime, said plainly, and nothing calls the read
// provisional just because the flip is missing.
test('no flip + negative net GEX at spot: short gamma, not unresolved', () => {
  const { model, report } = modelFor({ gamma_flip: null, net_gex_at_spot: -1.03e9 });
  assert.equal(report.regime, 'negative');
  assert.equal(model.heading, 'Dealers short gamma, with no flip near spot.');
  assert.equal(model.subject, "Today's Read · SPX: Dealers short gamma, with no flip near spot");
  assert.equal(model.levels.find((l) => l.label === 'Net GEX')!.value, '−$1.03B');
  assert.doesNotMatch(model.lead, /provisional|unresolved/i);
});

test('no flip + positive net GEX at spot: long gamma, not unresolved', () => {
  const { model, report } = modelFor({ gamma_flip: null, net_gex_at_spot: 2.4e9 });
  assert.equal(report.regime, 'positive');
  assert.equal(model.heading, 'Dealers long gamma, with no flip near spot.');
  assert.doesNotMatch(model.lead, /provisional|unresolved/i);
});

test('no flip + no net GEX at spot: the one morning that reads unresolved', () => {
  const { model, report } = modelFor({ gamma_flip: null, net_gex_at_spot: null });
  assert.equal(report.regime, 'unresolved');
  assert.equal(model.heading, 'The gamma regime is unresolved this morning.');
  assert.equal(model.levels.find((l) => l.label === 'Gamma flip')!.value, 'unresolved');
  assert.ok(!model.levels.some((l) => l.label === 'Net GEX'));
});

test('rendered: the read, the levels, the six rows, the dashboard and the stop link', () => {
  const { model } = modelFor();
  const stopUrl = buildPreopenReadStopUrl('https://zerogex.io', 'user_1');
  const { subject, text, html } = renderPreopenReadEmail(model, { stopUrl, siteUrl: 'https://zerogex.io', firstSend: false });
  assert.equal(subject, model.subject);
  for (const body of [text, html]) {
    assert.ok(body.includes("Today's Read · SPX · before Monday's open") || body.includes('Today&#39;s Read · SPX · before Monday&#39;s open'));
    assert.match(body, /Dealers long gamma above the 6,780 flip\./);
    assert.match(body, /as of Fri 3:59 PM ET/);
    assert.match(body, /https:\/\/zerogex\.io\/dashboard/);
    assert.match(body, /Stop these morning emails/);
    assert.match(body, /QQQ/); // named as not included
    assert.match(body, /modeled from open interest, not observed/);
    // A member email: no sales copy.
    assert.doesNotMatch(body, /trial|subscribe|pricing|% off|upgrade/i);
  }
  assert.ok(text.includes(stopUrl));
  assert.ok(html.includes(stopUrl.replace(/&/g, '&amp;')));
  assert.ok(text.includes(model.lead));
  // Not their first: no introduction.
  assert.ok(!text.includes(PREOPEN_FIRST_SEND_NOTE));
});

test('rendered: the first one says what it is and that one click stops it', () => {
  const { model } = modelFor();
  const stopUrl = buildPreopenReadStopUrl('https://zerogex.io', 'user_1');
  const first = renderPreopenReadEmail(model, { stopUrl, siteUrl: 'https://zerogex.io', firstSend: true });
  assert.ok(first.text.includes(PREOPEN_FIRST_SEND_NOTE));
  assert.match(first.html, /New for members/);
  // The note sits above the read, not under it.
  assert.ok(first.text.indexOf(PREOPEN_FIRST_SEND_NOTE) < first.text.indexOf(model.heading));
});

// ── Who gets it ─────────────────────────────────────────────────────────────

const db = getDb();
function addUser(id: string, tier: string, over: { deleted?: boolean; createdAt?: string } = {}) {
  const at = over.createdAt ?? '2026-11-01T00:00:00.000Z';
  db.prepare(`INSERT INTO users (id, email, tier, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`).run(
    id, `${id}@example.com`, tier, at, at,
  );
  if (over.deleted) db.prepare(`UPDATE users SET deleted_at = ? WHERE id = ?`).run(at, id);
}

addUser('user_basic', 'basic', { createdAt: '2026-10-01T00:00:00.000Z' });
addUser('user_pro', 'pro', { createdAt: '2026-10-02T00:00:00.000Z' });
addUser('user_public', 'public');
addUser('user_admin', 'admin');
addUser('user_deleted', 'pro', { deleted: true });
addUser('user_stopper', 'pro');

test('recipients: members with paid access, oldest first, everyone else left out', () => {
  const audience = listPreopenReadRecipients(SESSION);
  assert.deepEqual(audience.recipients.map((r) => r.id), ['user_basic', 'user_pro', 'user_stopper']);
  assert.ok(audience.recipients.every((r) => r.firstSend));
  assert.equal(audience.members, 3);
  assert.equal(audience.stopped, 0);
  assert.equal(audience.alreadySent, 0);
});

test('recipients: the stop link takes a member out for good, and repeats are harmless', () => {
  assert.equal(stopPreopenRead('user_stopper', '2026-11-22T10:00:00.000Z'), true);
  assert.equal(stopPreopenRead('user_stopper', '2026-11-22T11:00:00.000Z'), true);
  const row = db.prepare(`SELECT preopen_read_opt_out_at FROM users WHERE id = ?`).get('user_stopper') as {
    preopen_read_opt_out_at: string;
  };
  assert.equal(row.preopen_read_opt_out_at, '2026-11-22T10:00:00.000Z');
  assert.equal(stopPreopenRead('user_nobody'), false);

  const audience = listPreopenReadRecipients(SESSION);
  assert.deepEqual(audience.recipients.map((r) => r.id), ['user_basic', 'user_pro']);
  assert.equal(audience.stopped, 1);
});

test('recipients: a re-run skips anyone already sent that session, and the next day is not a first', () => {
  markPreopenReadSent('user_basic', SESSION);
  const rerun = listPreopenReadRecipients(SESSION);
  assert.deepEqual(rerun.recipients.map((r) => r.id), ['user_pro']);
  assert.equal(rerun.alreadySent, 1);

  const tomorrow = listPreopenReadRecipients('2026-11-24');
  assert.deepEqual(
    tomorrow.recipients.map((r) => `${r.id}:${r.firstSend ? 'first' : 'regular'}`),
    ['user_basic:regular', 'user_pro:first'],
  );
});

test('recipients: LIMIT bounds a run without changing who is next', () => {
  const limited = listPreopenReadRecipients('2026-11-24', 1);
  assert.deepEqual(limited.recipients.map((r) => r.id), ['user_basic']);
  assert.equal(limited.members, 3);
});
