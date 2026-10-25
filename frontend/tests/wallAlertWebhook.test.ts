// Wall alerts in Discord and Slack: which addresses the server will post to,
// how an alert reads in each, what a provider's answer means, and who gets
// what — core/wallAlertWebhook.ts, without a network.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_ALERTS_PER_WEBHOOK_MESSAGE,
  WebhookSendError,
  buildDiscordMessage,
  buildSlackMessage,
  buildWebhookTestMessage,
  classifyWebhookFailure,
  maskWebhookUrl,
  parseWebhookUrl,
  planWebhookDeliveries,
  postWebhook,
  type WebhookDestination,
  type WebhookMember,
} from '../core/wallAlertWebhook.ts';
import type { WallAlertPayload } from '../core/wallAlerts.ts';
import type { QueuedWallAlert } from '../core/wallAlertsServer.ts';

// Made-up addresses, built from parts so no whole webhook address sits in the
// repository: a secret scanner rightly cannot tell a fake one from a real one.
const DISCORD = ['https://discord.com/api/webhooks', '123456789012345678', 'AbCdEfGhIjKlMnOpQrStUvWxYz_-0123456789'].join('/');
const SLACK = ['https://hooks.slack.com/services', 'T0123ABCD', 'B0456EFGH', 'abcdefghijklmnopqrstuvwx'].join('/');
const APP = 'https://zerogex.io/';

function payload(overrides: Partial<WallAlertPayload> = {}): WallAlertPayload {
  return {
    v: 1,
    symbol: 'SPY',
    side: 'put',
    kind: 'hit',
    wall: 772,
    price: 772.31,
    last_price: 772.31,
    distance: 0.31,
    profile: 'balanced',
    break_buffer: 0.77,
    confirm_minutes: 5,
    strength_pctile: 88,
    strength_tier: 'strong',
    regime: 'positive',
    approach_number: 1,
    odds: [{ horizon_minutes: 60, break_prob: 0.34 }],
    ...overrides,
  };
}

// ── Addresses ───────────────────────────────────────────────────────────────

test('Discord and Slack webhooks are accepted and stored in one canonical form', () => {
  assert.deepEqual(parseWebhookUrl(DISCORD), { ok: true, provider: 'discord', url: DISCORD });
  assert.deepEqual(parseWebhookUrl(`  ${SLACK}  `), { ok: true, provider: 'slack', url: SLACK });
  for (const variant of [
    DISCORD.replace('discord.com', 'discordapp.com'),
    DISCORD.replace('discord.com', 'ptb.discord.com'),
    DISCORD.replace('discord.com', 'canary.discord.com'),
    DISCORD.replace('/api/webhooks/', '/api/v10/webhooks/'),
    `${DISCORD}/`,
    DISCORD.replace('https://discord.com', 'https://DISCORD.com'),
  ]) {
    assert.deepEqual(parseWebhookUrl(variant), { ok: true, provider: 'discord', url: DISCORD }, variant);
  }
  // Posting into a Discord thread is the one option kept.
  const thread = parseWebhookUrl(`${DISCORD}?thread_id=998877665544332211`);
  assert.equal(thread.ok && thread.url, `${DISCORD}?thread_id=998877665544332211`);
});

test('nothing else is accepted, so a member cannot aim the server anywhere else', () => {
  const cases: Array<[unknown, string]> = [
    [undefined, 'not_url'],
    [42, 'not_url'],
    ['', 'empty'],
    ['   ', 'empty'],
    ['discord.com/api/webhooks/1/2', 'not_url'],
    [`https://x.example/${'a'.repeat(300)}`, 'too_long'],
    [DISCORD.replace('https:', 'http:'), 'not_https'],
    ['javascript:alert(1)', 'not_https'],
    [DISCORD.replace('discord.com', 'discord.com.evil.example'), 'not_webhook'],
    [DISCORD.replace('discord.com', 'evil.example/discord.com'), 'not_webhook'],
    [DISCORD.replace('discord.com', 'discord.com.'), 'not_webhook'],
    [DISCORD.replace('discord.com', 'discord.com:8443'), 'not_webhook'],
    [DISCORD.replace('https://', 'https://user:pass@'), 'not_webhook'],
    [`${DISCORD}#x`, 'not_webhook'],
    [`${DISCORD}?wait=true`, 'not_webhook'],
    [`${DISCORD}?thread_id=abc`, 'not_webhook'],
    ['https://discord.com/api/webhooks/123/short', 'not_webhook'],
    ['https://discord.com/api/channels/123456789012345678/messages', 'not_webhook'],
    [`https://discord.com/api/webhooks/123456789012345678/../../users/@me`, 'not_webhook'],
    [`${SLACK}?x=1`, 'not_webhook'],
    ['https://hooks.slack.com/workflows/T0123ABCD/A0456/789/abcdefghijkl', 'not_webhook'],
    ['https://169.254.169.254/latest/meta-data/', 'not_webhook'],
    ['https://127.0.0.1:8000/api/alerts/walls/internal/queued', 'not_webhook'],
  ];
  for (const [raw, problem] of cases) {
    assert.deepEqual(parseWebhookUrl(raw), { ok: false, problem }, String(raw));
  }
});

test('a saved webhook is shown masked, never with its secret part', () => {
  assert.equal(maskWebhookUrl(DISCORD), 'discord.com/api/webhooks/1234…5678/••••••');
  assert.equal(maskWebhookUrl(SLACK), 'hooks.slack.com/services/T0123ABCD/B0456EFGH/••••••');
  assert.ok(!maskWebhookUrl(DISCORD).includes('AbCdEf'));
  assert.ok(!maskWebhookUrl(SLACK).includes('abcdefgh'));
  assert.equal(maskWebhookUrl('https://evil.example/'), '••••••');
});

// ── Messages ────────────────────────────────────────────────────────────────

test('a Discord message is one colored embed per alert, with the email wording', () => {
  const one = buildDiscordMessage([{ payload: payload(), at: '2026-10-23T14:05:00Z' }], APP) as {
    content?: string;
    embeds: Array<{ title: string; url: string; description: string; color: number; timestamp?: string }>;
    allowed_mentions: { parse: string[] };
  };
  assert.equal(one.content, undefined);
  assert.equal(one.embeds.length, 1);
  assert.equal(one.embeds[0].title, 'SPY put wall 772 hit (Strong)');
  assert.equal(one.embeds[0].url, 'https://zerogex.io/dashboard?symbol=SPY');
  assert.match(one.embeds[0].description, /Wall strength: Strong/);
  assert.equal(one.embeds[0].color, 0x0b5a80);
  assert.equal(one.embeds[0].timestamp, '2026-10-23T14:05:00.000Z');
  assert.deepEqual(one.allowed_mentions, { parse: [] });

  const broke = buildDiscordMessage(
    [
      { payload: payload({ kind: 'break', side: 'call', wall: 780 }), at: null },
      { payload: payload({ kind: 'break' }), at: null },
    ],
    APP,
  ) as { content: string; embeds: Array<{ color: number; timestamp?: string }> };
  assert.equal(broke.content, '2 wall alerts');
  // A call wall breaking is bullish, a put wall breaking bearish.
  assert.deepEqual(
    broke.embeds.map((e) => e.color),
    [0x0f7a3a, 0xa31226],
  );
  assert.equal(broke.embeds[0].timestamp, undefined);
});

test('ten alerts fit inside Discord’s 6,000-character message limit', () => {
  const items = Array.from({ length: MAX_ALERTS_PER_WEBHOOK_MESSAGE }, (_, i) => ({
    payload: payload({ symbol: 'NDX', wall: 27000 + i * 25, approach_number: 3, regime: 'negative' }),
    at: null,
  }));
  const msg = buildDiscordMessage(items, APP) as {
    embeds: Array<{ title: string; description: string; footer: { text: string } }>;
  };
  const total = msg.embeds.reduce((n, e) => n + e.title.length + e.description.length + e.footer.text.length, 0);
  assert.equal(msg.embeds.length, 10);
  assert.ok(total <= 6000, `embeds total ${total} characters`);
});

test('a Slack message escapes Slack’s control characters and carries a notification line', () => {
  const msg = buildSlackMessage([{ payload: payload({ symbol: 'A<B>&C' }), at: '2026-10-23T14:05:00Z' }], APP) as {
    text: string;
    blocks: Array<{ type: string; text?: { text: string }; elements?: Array<{ text: string }> }>;
  };
  assert.equal(msg.text, 'A<B>&C put wall 772 hit');
  const section = msg.blocks[0].text?.text ?? '';
  assert.match(section, /A&lt;B&gt;&amp;C put wall 772 hit \(Strong\)/);
  assert.ok(!section.includes('A<B>'));
  assert.ok(section.startsWith('🔵 *<https://zerogex.io/dashboard?symbol=A%3CB%3E%26C|'));
  assert.equal(msg.blocks[1].elements?.[0].text, '10:05 AM ET');
  assert.match(msg.blocks[msg.blocks.length - 1].elements?.[0].text ?? '', /account\/alerts\|Manage wall alerts/);
});

test('the test message says where it came from', () => {
  const discord = buildWebhookTestMessage('discord', APP) as { content: string };
  const slack = buildWebhookTestMessage('slack', APP) as { text: string };
  assert.match(discord.content, /ZeroGEX wall alerts are connected/);
  assert.match(slack.text, /https:\/\/zerogex\.io\/account\/alerts/);
});

// ── Provider answers ────────────────────────────────────────────────────────

test('a provider’s answer decides retry, fail, or "this webhook is gone"', () => {
  const limited = classifyWebhookFailure('discord', 429, '{"retry_after": 1.5}');
  assert.equal(limited.retryable, true);
  assert.equal(limited.retryAfterMs, 1500);
  assert.equal(classifyWebhookFailure('slack', 429, 'rate_limited', '3').retryAfterMs, 3000);
  assert.equal(classifyWebhookFailure('slack', 503, '').retryable, true);
  // Gone only when the provider itself says so.
  for (const [provider, status, body] of [
    ['discord', 404, '{"message": "Unknown Webhook", "code": 10015}'],
    ['discord', 401, '{"message": "Invalid Webhook Token", "code": 50027}'],
    ['slack', 404, 'no_service'],
    ['slack', 403, 'invalid_token'],
    ['slack', 410, 'channel_is_archived'],
  ] as const) {
    const gone = classifyWebhookFailure(provider, status, body);
    assert.equal(gone.broken, true, `${provider} ${status}`);
    assert.equal(gone.retryable, false);
  }
  // A CDN's 403 page in front of Discord says nothing about the webhook: retry.
  const blocked = classifyWebhookFailure('discord', 403, '<html><title>Attention Required! | Cloudflare</title></html>');
  assert.equal(blocked.broken, false);
  assert.equal(blocked.retryable, true);
  // A redirect is never a webhook's answer: that alert fails, the webhook is not condemned.
  const moved = classifyWebhookFailure('discord', 302, '');
  assert.equal(moved.broken || moved.retryable, false);
  assert.match(classifyWebhookFailure('slack', 404, 'no_service').message, /Slack says this webhook no longer works \(404: no_service\)/);
  // Discord's JSON is reduced to its message.
  assert.match(
    classifyWebhookFailure('discord', 404, '{"message": "Unknown Webhook", "code": 10015}').message,
    /^Discord says this webhook no longer works \(404: Unknown Webhook\)\./,
  );
  const refused = classifyWebhookFailure('slack', 400, 'invalid_blocks');
  assert.equal(refused.broken || refused.retryable, false);
});

test('postWebhook posts JSON to the canonical address and never follows a redirect', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const ok = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(null, { status: 204 });
  }) as unknown as typeof fetch;
  await postWebhook(DISCORD.replace('discord.com', 'discordapp.com'), { content: 'hi' }, { fetchImpl: ok });
  assert.equal(calls[0].url, DISCORD);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.redirect, 'manual');
  assert.equal(calls[0].init.body, '{"content":"hi"}');

  const gone = (async () => new Response('{"message":"Unknown Webhook"}', { status: 404 })) as unknown as typeof fetch;
  await assert.rejects(postWebhook(DISCORD, {}, { fetchImpl: gone }), (err: unknown) => {
    return err instanceof WebhookSendError && err.broken && err.status === 404;
  });
  const down = (async () => {
    throw new TypeError('fetch failed');
  }) as unknown as typeof fetch;
  await assert.rejects(postWebhook(SLACK, {}, { fetchImpl: down }), (err: unknown) => {
    return err instanceof WebhookSendError && err.retryable && err.status === null;
  });
});

test('postWebhook refuses an address that is not a webhook without making a request', async () => {
  let called = false;
  const spy = (async () => {
    called = true;
    return new Response(null, { status: 204 });
  }) as unknown as typeof fetch;
  await assert.rejects(postWebhook('https://127.0.0.1:8000/x', {}, { fetchImpl: spy }), WebhookSendError);
  assert.equal(called, false);
});

// ── Who gets what ───────────────────────────────────────────────────────────

function row(id: number, end_user: string, over: Partial<WallAlertPayload> = {}): QueuedWallAlert {
  const p = payload(over);
  return {
    id,
    end_user,
    channel: 'webhook',
    attempts: 0,
    created_at: `2026-10-23T14:05:${String(id % 60).padStart(2, '0')}Z`,
    rule_id: 1,
    event_id: id,
    symbol: p.symbol,
    side: p.side,
    kind: p.kind,
    wall: p.wall,
    price: p.price,
    payload: p,
  };
}

const member = (id: string, tier = 'basic', deleted_at: string | null = null): WebhookMember => ({ id, tier, deleted_at });
const hook = (user_id: string, failed_at: string | null = null): WebhookDestination => ({
  user_id,
  url: DISCORD,
  provider: 'discord',
  failed_at,
});

test('each member’s alerts go to their webhook, ten to a message, and only theirs', () => {
  const rows = [
    ...Array.from({ length: 12 }, (_, i) => row(i + 1, 'ann', { wall: 700 + i })),
    row(20, 'ann', { wall: 700 }), // the same event again: one post
    row(30, 'ghost'),
    row(40, 'gone'),
    row(50, 'lapsed'),
    row(60, 'nohook'),
    row(70, 'broken'),
  ];
  const members = new Map(
    [member('ann', 'pro'), member('gone', 'basic', '2026-10-01'), member('lapsed', 'public'), member('nohook'), member('broken')].map(
      (m) => [m.id, m],
    ),
  );
  const hooks = new Map([hook('ann'), hook('gone'), hook('lapsed'), hook('broken', '2026-10-22T15:00:00Z')].map((h) => [h.user_id, h]));
  const plan = planWebhookDeliveries(rows, members, hooks);

  const sends = plan.filter((d) => d.action === 'send');
  assert.deepEqual(
    sends.map((d) => d.rows.length),
    [10, 2],
  );
  const reasons = plan
    .filter((d) => d.action === 'cancel')
    .map((d) => [d.rows.map((r) => r.id).join(','), d.reason, d.action === 'cancel' ? d.purgeUser ?? null : null]);
  assert.deepEqual(reasons, [
    ['20', 'duplicate in batch', null],
    ['30', 'unknown recipient', null],
    ['40', 'account deleted', 'gone'],
    ['50', 'plan does not include wall alerts', null],
    ['60', 'no Discord or Slack webhook saved', null],
    ['70', 'webhook not working since 2026-10-22T15:00:00Z', null],
  ]);
});
