// Wall alerts on the website: what an alert says (every channel, every
// locale), the email the worker sends, who the worker sends to, and the
// unsubscribe link's signature.
//
// The detection itself lives in zerogex-oa (src/alerts/, tests/test_wall_alert_*);
// these tests pin the website's half of the contract — the payload it renders
// is the one src/alerts/wall_payload.py writes.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EN_WALL_ALERT_COPY,
  SMS_MAX_LENGTH,
  formatWallAlert,
  fmtPrice,
  fmtStrike,
  ordinalSuffix,
  passesStrengthFloor,
  ruleInputProblem,
  strengthTierFor,
  wallAlertSmsText,
  DEFAULT_RULE_INPUT,
  PROFILE_TOUCH_BP,
  effectiveTouchBp,
  fmtEtDayTime,
  fmtTouchPct,
  ruleToInput,
  touchAmount,
  type WallAlertPayload,
  type WallAlertRule,
} from '../core/wallAlerts.ts';
import { WALL_ALERT_COPY_LOCALES, wallAlertCopyFor } from '../core/wallAlertsCopy.ts';
import { buildWallAlertEmail, wallAlertEmailSubject } from '../core/wallAlertEmail.ts';
import {
  OUTBOX_GRACE_MS,
  REPORT_EVERY_MS,
  SENT_LEDGER_TTL_MS,
  clearFailure,
  emptyWorkerState,
  forgetSent,
  noteFailure,
  outageLengthMs,
  parseWorkerState,
  planWallAlertDeliveries,
  pruneSentLedger,
  recordSent,
  splitAlreadySent,
  tierIncludesWallAlerts,
  type DeliveryUser,
  type WorkerState,
} from '../core/wallAlertsDelivery.ts';
import {
  buildWallAlertsUnsubUrl,
  verifyWallAlertsUnsubToken,
  wallAlertsAdminEnv,
  type QueuedWallAlert,
} from '../core/wallAlertsServer.ts';

function payload(overrides: Partial<WallAlertPayload> = {}): WallAlertPayload {
  return {
    v: 1,
    symbol: 'SPX',
    side: 'put',
    kind: 'hit',
    wall: 7700,
    price: 7702.5,
    last_price: 7703,
    distance: 2.5,
    bar_ts: '2026-10-13T14:15:00+00:00',
    profile: 'balanced',
    break_buffer: 7.7,
    hold_distance: 11.55,
    confirm_minutes: 5,
    strength: 3.1e9,
    strength_pctile: 88.2,
    strength_tier: 'strong',
    regime: 'positive',
    approach_number: 1,
    alerted_hit: true,
    peak: 7702.5,
    current_wall: 7700,
    odds: [
      { horizon_minutes: 30, break_prob: 0.153 },
      { horizon_minutes: 60, break_prob: 0.344 },
    ],
    ...overrides,
  };
}

// ── Formatting ──────────────────────────────────────────────────────────────

test('numbers: strikes drop trailing zeros, prices keep two decimals', () => {
  assert.equal(fmtStrike(7700), '7,700');
  assert.equal(fmtStrike(577.5), '577.5');
  assert.equal(fmtPrice(7702.5), '7,702.50');
  assert.equal(fmtPrice(null), '—');
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 88, 101, 112].map(ordinalSuffix), [
    '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '88th', '101st', '112th',
  ]);
});

test('a put-wall hit reads as price arriving from above', () => {
  const f = formatWallAlert(payload());
  assert.equal(f.headline, 'SPX put wall 7,700 hit');
  assert.equal(f.detail, 'Low 7,702.50 · 2.50 above the wall');
  assert.equal(f.kindChip, 'HIT');
  assert.equal(f.tone, 'info');
  assert.equal(f.facts[0], 'Wall strength: Strong · 88th percentile vs. the last 30 days at this time of day');
  assert.match(f.context[0], /long gamma/);
  // The 60-minute horizon is quoted, not the first one in the list.
  assert.match(f.context[1], /within 60 min of a test 34% of the time/);
});

test('a call-wall hit that overshoots says so', () => {
  const f = formatWallAlert(payload({ side: 'call', wall: 7720, price: 7722.4, distance: -2.4 }));
  assert.equal(f.headline, 'SPX call wall 7,720 hit');
  assert.equal(f.detail, 'High 7,722.40 · 2.40 through the wall');
});

test('a second approach is counted', () => {
  const f = formatWallAlert(payload({ approach_number: 2 }));
  assert.ok(f.facts.includes('2nd test today'));
});

test('a break names the confirmation and the next wall; its tone is the direction', () => {
  const f = formatWallAlert(
    payload({ kind: 'break', price: 7690.25, last_price: 7690.25, current_wall: 7650 }),
  );
  assert.equal(f.headline, 'SPX put wall 7,700 broke');
  assert.equal(f.detail, '5 straight 1-min closes below 7,692.30 · last 7,690.25');
  assert.ok(f.facts.includes('Next put wall: 7,650'));
  assert.equal(f.tone, 'bear');
  // Odds are a hit-time fact; an outcome does not repeat them.
  assert.equal(f.context.length, 1);
  const up = formatWallAlert(payload({ kind: 'break', side: 'call', wall: 7720, price: 7730, current_wall: 7750 }));
  assert.equal(up.tone, 'bull');
});

test('a hold names how far price was turned back', () => {
  const f = formatWallAlert(payload({ kind: 'hold', price: 7712, peak: 7700.4 }));
  assert.equal(f.headline, 'SPX put wall 7,700 held');
  assert.equal(f.detail, 'Bounced to 7,712.00 (12.00 off the wall) after a low of 7,700.40');
  assert.equal(f.tone, 'bull');
});

test('an unrated wall says so instead of inventing a tier', () => {
  const f = formatWallAlert(payload({ strength_pctile: null, strength_tier: null }));
  assert.equal(f.facts[0], 'Wall strength not rated yet');
  assert.equal(f.tierLabel, null);
});

test('strength tiers and the floor match the backend fan-out', () => {
  assert.deepEqual([0, 24.9, 25, 50, 74.9, 75, 89.9, 90].map(strengthTierFor), [
    'light', 'light', 'moderate', 'above_typical', 'above_typical', 'strong', 'strong', 'very_strong',
  ]);
  assert.equal(passesStrengthFloor(0, null), true);
  assert.equal(passesStrengthFloor(75, null), false); // unknown never satisfies a floor
  assert.equal(passesStrengthFloor(75, 74.9), false);
  assert.equal(passesStrengthFloor(75, 75), true);
});

test('every locale fills every template', () => {
  assert.deepEqual(WALL_ALERT_COPY_LOCALES.sort(), ['de', 'en', 'es', 'fr', 'it']);
  const variants: Array<Partial<WallAlertPayload>> = [
    {},
    { approach_number: 3 },
    { side: 'call', wall: 7720, price: 7719 },
    { kind: 'break', current_wall: 7650 },
    { kind: 'break', side: 'call', wall: 7720, price: 7730 },
    { kind: 'hold', price: 7712 },
    { kind: 'hold', side: 'call', wall: 7720, price: 7705, peak: 7721 },
    { regime: 'negative' },
  ];
  for (const locale of WALL_ALERT_COPY_LOCALES) {
    const copy = wallAlertCopyFor(locale);
    for (const v of variants) {
      const f = formatWallAlert(payload(v), copy);
      for (const line of [f.headline, f.detail, ...f.facts, ...f.context]) {
        assert.doesNotMatch(line, /\{\w+\}/, `${locale}: unfilled placeholder in "${line}"`);
        assert.doesNotMatch(line, /undefined|NaN/, `${locale}: "${line}"`);
      }
    }
  }
  assert.equal(wallAlertCopyFor('xx'), EN_WALL_ALERT_COPY);
  assert.equal(formatWallAlert(payload(), wallAlertCopyFor('es')).facts[0].includes('percentil 88'), true);
});

// ── SMS ─────────────────────────────────────────────────────────────────────

test('SMS is one GSM-7 segment, whatever the alert', () => {
  for (const v of [
    {},
    { kind: 'break' as const, current_wall: 7650 },
    { kind: 'hold' as const, price: 7712 },
    { symbol: 'NDX', wall: 27250.5, price: 27252.75 },
  ]) {
    const sms = wallAlertSmsText(payload(v));
    assert.ok(sms.length <= SMS_MAX_LENGTH, `${sms.length}: ${sms}`);
    assert.match(sms, /^[\x20-\x7E]+$/, `non-GSM character in: ${sms}`);
    assert.match(sms, /^ZeroGEX: /);
    assert.match(sms, /STOP=opt out$/);
  }
  assert.equal(
    wallAlertSmsText(payload()),
    'ZeroGEX: SPX put wall 7,700 hit (Strong). Low 7,702.50 - 2.50 above the wall. zerogex.io/alerts STOP=opt out',
  );
});

// ── Rule input ──────────────────────────────────────────────────────────────

test('the form explains an empty event or channel set before posting', () => {
  assert.equal(ruleInputProblem(DEFAULT_RULE_INPUT), null);
  assert.equal(
    ruleInputProblem({ ...DEFAULT_RULE_INPUT, events: { hit: false, break: false, hold: false } }),
    'events',
  );
  assert.equal(
    ruleInputProblem({ ...DEFAULT_RULE_INPUT, channels: { in_app: false, email: false, webhook: false, sms: false } }),
    'channels',
  );
});

// ── Email ───────────────────────────────────────────────────────────────────

const APP = 'https://zerogex.io';
const UNSUB = 'https://zerogex.io/alerts/unsubscribe?u=u1&t=sig';

test('one alert: the subject is the headline and the tier', () => {
  const at = '2026-10-13T14:15:23+00:00';
  const email = buildWallAlertEmail({ alerts: [{ payload: payload(), at }], appUrl: APP, unsubUrl: UNSUB });
  assert.equal(email.subject, 'SPX put wall 7,700 hit (Strong)');
  assert.match(email.text, /HIT · SPX put wall 7,700 hit · 10:15 AM ET/);
  assert.match(email.text, /Open SPX levels: https:\/\/zerogex\.io\/dashboard\?symbol=SPX/);
  assert.match(email.text, /Manage your wall alerts: https:\/\/zerogex\.io\/account\/alerts/);
  assert.match(email.text, /Stop wall-alert emails: https:\/\/zerogex\.io\/alerts\/unsubscribe/);
  assert.match(email.text, /not financial advice/);
  assert.match(email.html, /SPX put wall 7,700 hit/);
  assert.match(email.html, /alerts\/unsubscribe\?u=u1&amp;t=sig/);
});

test('several alerts: one email, every symbol linked, the subject names them', () => {
  const email = buildWallAlertEmail({
    alerts: [
      { payload: payload(), at: null },
      { payload: payload({ symbol: 'SPY', wall: 770, price: 770.31, distance: 0.31 }), at: null },
    ],
    appUrl: APP,
    unsubUrl: UNSUB,
  });
  assert.equal(email.subject, '2 wall alerts: SPX put wall 7,700 hit, SPY put wall 770 hit');
  assert.match(email.html, /Open SPX levels/);
  assert.match(email.html, /Open SPY levels/);
  assert.equal((email.html.match(/border-left:4px solid/g) ?? []).length, 2);
});

test('a long batch subject is cut cleanly', () => {
  const alerts = Array.from({ length: 8 }, (_, i) => ({
    payload: payload({ symbol: ['SPX', 'SPY', 'QQQ', 'NDX'][i % 4], wall: 7700 + i }),
    at: null,
  }));
  const subject = wallAlertEmailSubject(alerts);
  assert.ok(subject.length <= 120, subject);
  assert.ok(subject.startsWith('8 wall alerts: '));
  assert.ok(subject.endsWith(', …'));
});

test('payload text is escaped in the html', () => {
  const email = buildWallAlertEmail({
    alerts: [{ payload: payload({ symbol: '<b>SPX</b>' }), at: null }],
    appUrl: APP,
    unsubUrl: UNSUB,
  });
  assert.doesNotMatch(email.html, /<b>SPX<\/b>/);
  assert.match(email.html, /&lt;b&gt;SPX&lt;\/b&gt;/);
});

// ── Who the worker sends to ─────────────────────────────────────────────────

let rowId = 0;
function row(endUser: string, overrides: Partial<WallAlertPayload> = {}, created = '2026-10-13T14:15:00Z'): QueuedWallAlert {
  rowId += 1;
  const p = payload(overrides);
  return {
    id: rowId,
    end_user: endUser,
    channel: 'email',
    attempts: 0,
    created_at: created,
    rule_id: 1,
    event_id: rowId,
    symbol: p.symbol,
    side: p.side,
    kind: p.kind,
    wall: p.wall,
    price: p.price,
    payload: p,
  };
}

function user(id: string, overrides: Partial<DeliveryUser> = {}): DeliveryUser {
  return {
    id,
    email: `${id}@example.com`,
    email_verified_at: '2026-01-01T00:00:00Z',
    tier: 'basic',
    deleted_at: null,
    ...overrides,
  };
}

test('one email per member, every member resolved for a reason', () => {
  const rows = [
    row('alice'),
    row('alice', { symbol: 'SPY', wall: 770, price: 770.3 }),
    row('bob'),
    row('carol'),
    row('dave'),
    row('erin'),
    row('ghost'),
  ];
  const users = new Map<string, DeliveryUser>([
    ['alice', user('alice', { tier: 'pro' })],
    ['bob', user('bob', { tier: 'public' })],
    ['carol', user('carol', { email_verified_at: null })],
    ['dave', user('dave', { deleted_at: '2026-10-01T00:00:00Z' })],
    ['erin', user('erin', { tier: 'admin' })],
  ]);
  const plan = planWallAlertDeliveries(rows, users);
  const byUser = new Map(plan.map((d) => [d.rows[0].end_user, d]));

  const alice = byUser.get('alice')!;
  assert.equal(alice.action, 'send');
  assert.equal(alice.rows.length, 2);
  assert.equal(byUser.get('erin')!.action, 'send');

  const bob = byUser.get('bob')!;
  assert.equal(bob.action, 'cancel');
  assert.equal(bob.action === 'cancel' && bob.reason, 'plan does not include wall alerts');
  assert.equal(bob.action === 'cancel' && bob.purgeUser, undefined);

  const carol = byUser.get('carol')!;
  assert.equal(carol.action === 'cancel' && carol.reason, 'email not verified');

  const dave = byUser.get('dave')!;
  assert.equal(dave.action === 'cancel' && dave.purgeUser, 'dave');

  // An unknown id is cancelled but NEVER purged: it is as likely a wrong
  // AUTH_DB_PATH as a vanished account, and purging on it would wipe everyone.
  const ghost = byUser.get('ghost')!;
  assert.equal(ghost.action === 'cancel' && ghost.reason, 'unknown recipient');
  assert.equal(ghost.action === 'cancel' && ghost.purgeUser, undefined);
});

test('plan entitlement is checked by rank, with no dev-mode bypass', () => {
  // core/auth.ts hasTierAccess passes everyone when NEXT_PUBLIC_AUTH_ENABLED is
  // unset; the worker must not inherit that.
  const before = process.env.NEXT_PUBLIC_AUTH_ENABLED;
  delete process.env.NEXT_PUBLIC_AUTH_ENABLED;
  try {
    assert.equal(tierIncludesWallAlerts('public'), false);
    assert.equal(tierIncludesWallAlerts(null), false);
    assert.equal(tierIncludesWallAlerts('nonsense'), false);
    assert.equal(tierIncludesWallAlerts('basic'), true);
    assert.equal(tierIncludesWallAlerts('starter'), true); // legacy id folds into basic
    assert.equal(tierIncludesWallAlerts('pro'), true);
    assert.equal(tierIncludesWallAlerts('admin'), true);
  } finally {
    if (before !== undefined) process.env.NEXT_PUBLIC_AUTH_ENABLED = before;
  }
});

test('the same wall event queued twice in one pass is sent once', () => {
  const rows = [row('alice'), row('alice'), row('alice', { kind: 'break' })];
  const plan = planWallAlertDeliveries(rows, new Map([['alice', user('alice')]]));
  const send = plan.find((d) => d.action === 'send')!;
  const dupes = plan.find((d) => d.action === 'cancel')!;
  assert.equal(send.rows.length, 2);
  assert.equal(dupes.rows.length, 1);
  assert.equal(dupes.action === 'cancel' && dupes.reason, 'duplicate in batch');
});

test('a big backlog is split into emails of at most ten alerts', () => {
  const rows = Array.from({ length: 23 }, (_, i) => row('alice', { wall: 7000 + i }));
  const plan = planWallAlertDeliveries(rows, new Map([['alice', user('alice')]]));
  assert.deepEqual(
    plan.map((d) => d.rows.length),
    [10, 10, 3],
  );
});

// ── Worker state: failure reports and the sent ledger ───────────────────────

const T0 = Date.parse('2026-10-14T14:00:00Z');
const at = (ms: number) => new Date(T0 + ms);

/** Run `noteFailure` once per 20-second pass from `fromMs` to `toMs`; return the report times. */
function passes(state: WorkerState, kind: Parameters<typeof noteFailure>[1], fromMs: number, toMs: number) {
  const reports: number[] = [];
  let s = state;
  for (let t = fromMs; t <= toMs; t += 20_000) {
    const r = noteFailure(s, kind, at(t));
    s = r.state;
    if (r.report) reports.push(t);
  }
  return { state: s, reports };
}

test('an API restart is never reported; a real outbox outage is, then hourly', () => {
  // Down for one minute (a restart): every pass exits 0.
  const restart = passes(emptyWorkerState(), 'outbox', 0, 60_000);
  assert.deepEqual(restart.reports, []);
  assert.equal(outageLengthMs(restart.state, at(80_000)), 80_000);
  const recovered = clearFailure(restart.state, 'outbox');
  assert.equal(recovered.outageSince, null);
  assert.equal(outageLengthMs(recovered, at(80_000)), null);

  // Down for three hours: reported at five minutes, then once an hour.
  const outage = passes(emptyWorkerState(), 'outbox', 0, 3 * 60 * 60_000);
  assert.deepEqual(outage.reports, [OUTBOX_GRACE_MS, OUTBOX_GRACE_MS + REPORT_EVERY_MS, OUTBOX_GRACE_MS + 2 * REPORT_EVERY_MS]);
});

test('other failures are reported at once, then hourly, and re-arm once the step works', () => {
  const config = passes(emptyWorkerState(), 'config', 0, 2 * 60 * 60_000);
  assert.deepEqual(config.reports, [0, REPORT_EVERY_MS, 2 * REPORT_EVERY_MS]);

  // Kinds are throttled apart: an hourly config report does not hide a crash.
  const crash = noteFailure(config.state, 'crash', at(10 * 60_000));
  assert.equal(crash.report, true);

  // Fixed, then broken again ten minutes later: reported again straight away.
  const fixed = clearFailure(config.state, 'config');
  assert.equal(noteFailure(fixed, 'config', at(2 * 60 * 60_000 + 10 * 60_000)).report, true);
});

test('a sent row is re-marked, never re-sent, until the ledger entry ages out', () => {
  let state = recordSent(emptyWorkerState(), [11, 12], at(0));
  const rows = [{ id: 11 }, { id: 12 }, { id: 13 }];
  const split = splitAlreadySent(rows, state);
  assert.deepEqual(split.alreadySent.map((r) => r.id), [11, 12]);
  assert.deepEqual(split.fresh.map((r) => r.id), [13]);

  state = forgetSent(state, [11]);
  assert.deepEqual(Object.keys(state.sentAwaitingMark), ['12']);
  assert.deepEqual(Object.keys(pruneSentLedger(state, at(SENT_LEDGER_TTL_MS - 1)).sentAwaitingMark), ['12']);
  assert.deepEqual(pruneSentLedger(state, at(SENT_LEDGER_TTL_MS)).sentAwaitingMark, {});
});

test('the state file survives a round trip and shrugs off anything unreadable', () => {
  const state = noteFailure(recordSent(emptyWorkerState(), [7], at(0)), 'config', at(0)).state;
  assert.deepEqual(parseWorkerState(JSON.stringify(state)), state);
  assert.deepEqual(parseWorkerState(null), emptyWorkerState());
  assert.deepEqual(parseWorkerState('{not json'), emptyWorkerState());
  assert.deepEqual(parseWorkerState('[]'), emptyWorkerState());
  assert.deepEqual(
    parseWorkerState(
      JSON.stringify({
        outageSince: 'yesterday-ish',
        reportedAt: { config: 'not a date', bogus: at(0).toISOString() },
        sentAwaitingMark: { abc: at(0).toISOString(), 9: 'nope', 10: at(0).toISOString() },
      }),
    ),
    { outageSince: null, reportedAt: {}, sentAwaitingMark: { 10: at(0).toISOString() } },
  );
});

// ── Unsubscribe link and outbox credentials ─────────────────────────────────

test('the unsubscribe link verifies, and only for its own member and purpose', () => {
  process.env.ZEROGEX_END_USER_TOKEN_SECRET = 'test-secret';
  const url = new URL(buildWallAlertsUnsubUrl('https://zerogex.io/', 'user-1'));
  assert.equal(url.pathname, '/alerts/unsubscribe');
  const u = url.searchParams.get('u');
  const t = url.searchParams.get('t');
  assert.equal(verifyWallAlertsUnsubToken(u, t), true);
  assert.equal(verifyWallAlertsUnsubToken('user-2', t), false);
  assert.equal(verifyWallAlertsUnsubToken(u, `${t}x`), false);
  assert.equal(verifyWallAlertsUnsubToken(null, t), false);
});

test('the outbox needs both the bearer key and the admin token', () => {
  assert.equal(wallAlertsAdminEnv({ ZEROGEX_API_TOKEN: 'k' }), null);
  assert.equal(wallAlertsAdminEnv({ ZEROGEX_ADMIN_TOKEN: 'a' }), null);
  assert.deepEqual(wallAlertsAdminEnv({ ZEROGEX_API_KEY: 'legacy', ZEROGEX_ADMIN_TOKEN: 'a' }), {
    baseUrl: 'http://127.0.0.1:8000',
    apiToken: 'legacy',
    adminToken: 'a',
  });
});

// ── Touch tolerance ─────────────────────────────────────────────────────────

test('Auto follows the noise filter, and an explicit tolerance wins', () => {
  assert.equal(effectiveTouchBp('balanced', null), 5);
  assert.equal(effectiveTouchBp('responsive', null), 8);
  assert.equal(effectiveTouchBp('conservative', undefined), 3);
  assert.equal(effectiveTouchBp('conservative', 25), 25);
  // The API's own numbers beat the fallback when the config has loaded.
  const profiles = [{ name: 'balanced' as const, touch_pct: 0.0006, touch_bp: 6, arm_buffers: 1.5, cooldown_minutes: 20, confirm_minutes: 5, hold_buffers: 1.5, resolution_minutes: 60, open_grace_minutes: 3 }];
  assert.equal(effectiveTouchBp('balanced', null, profiles), 6);
  assert.deepEqual(PROFILE_TOUCH_BP, { responsive: 8, balanced: 5, conservative: 3 });
});

test('a tolerance reads as a percent and as a price on the wall', () => {
  assert.equal(fmtTouchPct(1), '0.01%');
  assert.equal(fmtTouchPct(5), '0.05%');
  assert.equal(fmtTouchPct(25), '0.25%');
  // 9 cents short of a 772 SPY wall is inside 0.05% ($0.39) but not 0.01% ($0.08).
  assert.deepEqual(touchAmount('SPY', 772, 5), { text: '$0.39', points: false });
  assert.deepEqual(touchAmount('SPY', 772, 1), { text: '$0.08', points: false });
  assert.deepEqual(touchAmount('SPX', 7700, 5), { text: '3.9', points: true });
  assert.deepEqual(touchAmount('ndx', 27000, 25), { text: '68', points: true });
});

test('a new rule starts on Auto and an edited rule keeps its tolerance', () => {
  assert.equal(DEFAULT_RULE_INPUT.touch_bp, null);
  const rule: WallAlertRule = {
    id: 1,
    symbol: 'SPY',
    side: 'call',
    events: { hit: true, break: true, hold: false },
    min_strength_pctile: 75,
    profile: 'balanced',
    touch_bp: 10,
    channels: { in_app: true, email: true, webhook: false, sms: false },
    enabled: true,
    created_at: null,
    updated_at: null,
    last_triggered_at: null,
  };
  assert.equal(ruleToInput(rule).touch_bp, 10);
  assert.equal(ruleToInput({ ...rule, touch_bp: null }).touch_bp, null);
  // A rule from an API that predates the field reads as Auto.
  const legacy = { ...rule } as Partial<WallAlertRule>;
  delete legacy.touch_bp;
  assert.equal(ruleToInput(legacy as WallAlertRule).touch_bp, null);
});

test('a new rule runs every day, and editing keeps a today-only rule today only', () => {
  assert.equal(DEFAULT_RULE_INPUT.today_only, false);
  const rule: WallAlertRule = {
    id: 2,
    symbol: 'SPX',
    side: 'put',
    events: { hit: true, break: true, hold: false },
    min_strength_pctile: 0,
    profile: 'balanced',
    touch_bp: null,
    channels: { in_app: true, email: false, webhook: false, sms: false },
    enabled: true,
    today_only: true,
    expires_on: '2026-10-23',
    ends_at: '2026-10-23T20:00:00+00:00',
    ended: true,
    created_at: null,
    updated_at: null,
    last_triggered_at: null,
  };
  const input = ruleToInput(rule);
  assert.equal(input.today_only, true);
  // The read-only fields never go back to the API.
  assert.equal('expires_on' in input || 'ends_at' in input || 'ended' in input, false);
  // A rule from an API that predates the field runs every day.
  const legacy = { ...rule } as Partial<WallAlertRule>;
  delete legacy.today_only;
  assert.equal(ruleToInput(legacy as WallAlertRule).today_only, false);
});

test('a today-only alert says when it stops, in Eastern time', () => {
  assert.equal(fmtEtDayTime('2026-10-23T20:00:00+00:00'), 'Fri, Oct 23, 4:00 PM ET');
  // A half day after the clocks change: 13:00 EST.
  assert.equal(fmtEtDayTime('2026-11-27T18:00:00+00:00'), 'Fri, Nov 27, 1:00 PM ET');
  assert.equal(fmtEtDayTime(null), '');
  assert.equal(fmtEtDayTime('not a date'), '');
});
