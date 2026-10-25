// Wall alerts in a member's own Discord or Slack channel: which webhook
// addresses we accept, how an alert reads there, and what each provider's
// answer means. Used by the account route that saves a webhook
// (app/api/account/alert-webhook) and by the delivery worker
// (scripts/wall-alerts-webhooks.mts), so a test message and a real alert go
// through the same code.
//
// Everything here is pure except postWebhook (one fetch), so
// tests/wallAlertWebhook.test.ts pins the rules without a network.
//
// NO '@/' ALIAS: imported by a --experimental-strip-types script.

import { fmtEtTime, formatWallAlert, type FormattedWallAlert, type WallAlertPayload } from './wallAlerts.ts';
import { splitDuplicateEvents, tierIncludesWallAlerts } from './wallAlertsDelivery.ts';
import type { QueuedWallAlert } from './wallAlertsServer.ts';

export type WebhookProvider = 'discord' | 'slack';

// ── Which addresses we post to ──────────────────────────────────────────────
//
// The server POSTs to whatever a member saves, so the address is the one thing
// a member could aim at our infrastructure. Only the two providers' own
// webhook endpoints are accepted, over https on the default port, with no
// credentials, fragment or stray query, and the stored address is rebuilt from
// the parsed parts rather than kept as typed. postWebhook re-checks before
// every request and never follows a redirect.

const DISCORD_HOSTS = new Set(['discord.com', 'discordapp.com', 'ptb.discord.com', 'canary.discord.com']);
const SLACK_HOST = 'hooks.slack.com';
const DISCORD_PATH = /^\/api(?:\/v\d{1,2})?\/webhooks\/(\d{15,25})\/([A-Za-z0-9_-]{20,120})\/?$/;
const SLACK_PATH = /^\/services\/(T[A-Z0-9]{4,20})\/(B[A-Z0-9]{4,20})\/([A-Za-z0-9]{10,64})\/?$/;

export const WEBHOOK_URL_MAX = 300;

export type WebhookUrlProblem = 'empty' | 'too_long' | 'not_url' | 'not_https' | 'not_webhook';

export type ParsedWebhookUrl =
  | { ok: true; url: string; provider: WebhookProvider }
  | { ok: false; problem: WebhookUrlProblem };

export function parseWebhookUrl(raw: unknown): ParsedWebhookUrl {
  if (typeof raw !== 'string') return { ok: false, problem: 'not_url' };
  const text = raw.trim();
  if (!text) return { ok: false, problem: 'empty' };
  if (text.length > WEBHOOK_URL_MAX) return { ok: false, problem: 'too_long' };
  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return { ok: false, problem: 'not_url' };
  }
  if (u.protocol !== 'https:') return { ok: false, problem: 'not_https' };
  if (u.username || u.password || u.port || u.hash) return { ok: false, problem: 'not_webhook' };
  const host = u.hostname.toLowerCase();

  if (DISCORD_HOSTS.has(host)) {
    const m = DISCORD_PATH.exec(u.pathname);
    if (!m) return { ok: false, problem: 'not_webhook' };
    // Discord's one documented option for a webhook: post into a thread.
    const keys = Array.from(u.searchParams.keys());
    const thread = u.searchParams.get('thread_id');
    if (keys.some((k) => k !== 'thread_id') || (thread !== null && !/^\d{15,25}$/.test(thread))) {
      return { ok: false, problem: 'not_webhook' };
    }
    const query = thread ? `?thread_id=${thread}` : '';
    return { ok: true, provider: 'discord', url: `https://discord.com/api/webhooks/${m[1]}/${m[2]}${query}` };
  }
  if (host === SLACK_HOST) {
    const m = SLACK_PATH.exec(u.pathname);
    if (!m || u.search) return { ok: false, problem: 'not_webhook' };
    return { ok: true, provider: 'slack', url: `https://hooks.slack.com/services/${m[1]}/${m[2]}/${m[3]}` };
  }
  return { ok: false, problem: 'not_webhook' };
}

/** A saved webhook as its member sees it (GET /api/account/alert-webhook): never the address itself. */
export interface AlertWebhookView {
  provider: WebhookProvider;
  masked: string;
  created_at: string;
  updated_at: string;
  last_ok_at: string | null;
  /** Set when the provider said the webhook is gone; cleared by a new save or a passing test. */
  failed_at: string | null;
  last_error: string | null;
}

/**
 * The address as a member may see it again: enough to recognize, never the
 * secret part. Anyone holding a webhook's full address can post to it.
 */
export function maskWebhookUrl(url: string): string {
  const parsed = parseWebhookUrl(url);
  if (!parsed.ok) return '••••••';
  const u = new URL(parsed.url);
  const parts = u.pathname.split('/');
  if (parsed.provider === 'discord') {
    const id = parts[3] ?? '';
    return `discord.com/api/webhooks/${id.slice(0, 4)}…${id.slice(-4)}/••••••`;
  }
  return `hooks.slack.com/services/${parts[2] ?? ''}/${parts[3] ?? ''}/••••••`;
}

// ── Messages ────────────────────────────────────────────────────────────────

/** Alerts per message: Discord allows 10 embeds, and the email batches the same. */
export const MAX_ALERTS_PER_WEBHOOK_MESSAGE = 10;

export interface WebhookAlertItem {
  payload: WallAlertPayload;
  /** When the alert fired (the delivery row's created_at). */
  at: string | null;
}

// The email's tone colors, so an alert is the same color everywhere.
const DISCORD_COLOR: Record<FormattedWallAlert['tone'], number> = {
  info: 0x0b5a80,
  bull: 0x0f7a3a,
  bear: 0xa31226,
  neutral: 0x374151,
};
const SLACK_MARK: Record<FormattedWallAlert['tone'], string> = {
  info: '🔵',
  bull: '🟢',
  bear: '🔴',
  neutral: '⚪',
};

const FOOTER = 'ZeroGEX wall alert · informational market data, not financial advice';
// Discord rejects a message whose embeds total more than 6,000 characters.
const DISCORD_EMBED_BUDGET = 5800;

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function base(appUrl: string): string {
  return appUrl.replace(/\/+$/, '');
}

function dashboardUrl(appUrl: string, symbol: string): string {
  return `${base(appUrl)}/dashboard?symbol=${encodeURIComponent(symbol)}`;
}

function validIso(at: string | null): string | undefined {
  return at && Number.isFinite(Date.parse(at)) ? new Date(at).toISOString() : undefined;
}

function title(f: FormattedWallAlert): string {
  return f.tierLabel ? `${f.headline} (${f.tierLabel})` : f.headline;
}

export function buildDiscordMessage(items: readonly WebhookAlertItem[], appUrl: string): Record<string, unknown> {
  const embedsWith = (withContext: boolean) =>
    items.map(({ payload, at }) => {
      const f = formatWallAlert(payload);
      const lines = [f.detail, ...f.facts, ...(withContext ? f.context : [])];
      return {
        title: clip(title(f), 256),
        url: dashboardUrl(appUrl, payload.symbol),
        description: clip(lines.join('\n'), 1500),
        color: DISCORD_COLOR[f.tone],
        ...(validIso(at) ? { timestamp: validIso(at) } : {}),
        footer: { text: FOOTER },
      };
    });
  const size = (embeds: ReturnType<typeof embedsWith>) =>
    embeds.reduce((n, e) => n + e.title.length + e.description.length + e.footer.text.length, 0);
  let embeds = embedsWith(true);
  // The "why it matters" lines go first if ten alerts would not fit.
  if (size(embeds) > DISCORD_EMBED_BUDGET) embeds = embedsWith(false);
  return {
    username: 'ZeroGEX',
    ...(items.length > 1 ? { content: `${items.length} wall alerts` } : {}),
    embeds,
    // Our own text, but never let it ping @everyone or a role.
    allowed_mentions: { parse: [] },
  };
}

/** Slack mrkdwn treats only these three as control characters. */
function slackEscape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildSlackMessage(items: readonly WebhookAlertItem[], appUrl: string): Record<string, unknown> {
  const formatted = items.map((item) => ({ item, f: formatWallAlert(item.payload) }));
  const blocks: unknown[] = [];
  for (const { item, f } of formatted) {
    const body = [
      `${SLACK_MARK[f.tone]} *<${dashboardUrl(appUrl, item.payload.symbol)}|${slackEscape(title(f))}>*`,
      slackEscape(f.detail),
      ...f.facts.map(slackEscape),
      ...f.context.map((line) => `_${slackEscape(line)}_`),
    ].join('\n');
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: clip(body, 2900) } });
    const when = fmtEtTime(item.at);
    if (when) blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: when }] });
  }
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `<${base(appUrl)}/account/alerts|Manage wall alerts> · informational market data, not financial advice`,
      },
    ],
  });
  return {
    // The notification text: what a phone shows before the message is opened.
    text: clip(formatted.map(({ f }) => f.headline).join(' · '), 300),
    blocks,
    unfurl_links: false,
    unfurl_media: false,
  };
}

export function buildWebhookMessage(
  provider: WebhookProvider,
  items: readonly WebhookAlertItem[],
  appUrl: string,
): Record<string, unknown> {
  return provider === 'discord' ? buildDiscordMessage(items, appUrl) : buildSlackMessage(items, appUrl);
}

/** What "Save" and "Send test" post: proof the address works, and where it came from. */
export function buildWebhookTestMessage(provider: WebhookProvider, appUrl: string): Record<string, unknown> {
  const text =
    'ZeroGEX wall alerts are connected. Alerts you send here will post in this channel. ' +
    `Choose which ones on ${base(appUrl)}/account/alerts`;
  return provider === 'discord'
    ? { username: 'ZeroGEX', content: `✅ ${text}`, allowed_mentions: { parse: [] } }
    : { text: `✅ ${text}`, unfurl_links: false };
}

// ── Sending ─────────────────────────────────────────────────────────────────

/**
 * Why a post did not land. ``retryable``: try again on a later pass (429, 5xx,
 * no answer, or a refusal that did not come from the provider itself).
 * ``broken``: the provider says the webhook is gone or revoked, so posting to
 * it again is pointless until the member saves a new one. Anything else (a
 * 400 on a message the provider would not take, a redirect) is neither: that
 * alert fails alone.
 */
export class WebhookSendError extends Error {
  readonly status: number | null;
  readonly retryable: boolean;
  readonly broken: boolean;
  readonly retryAfterMs: number | null;

  constructor(message: string, opts: { status: number | null; retryable: boolean; broken: boolean; retryAfterMs?: number | null }) {
    super(message);
    this.name = 'WebhookSendError';
    this.status = opts.status;
    this.retryable = opts.retryable;
    this.broken = opts.broken;
    this.retryAfterMs = opts.retryAfterMs ?? null;
  }
}

const PROVIDER_NAME: Record<WebhookProvider, string> = { discord: 'Discord', slack: 'Slack' };

function retryAfterMs(header: string | null, body: string): number | null {
  const seconds = header !== null ? Number(header) : NaN;
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  try {
    // Discord also says it in the body, in seconds.
    const parsed = JSON.parse(body) as { retry_after?: unknown };
    if (typeof parsed.retry_after === 'number' && parsed.retry_after >= 0) return Math.round(parsed.retry_after * 1000);
  } catch {
    /* not JSON */
  }
  return null;
}

/** The provider's own words for an error: Discord's JSON "message", or Slack's plain-text code. */
function providerReason(body: string): string {
  try {
    const parsed = JSON.parse(body) as { message?: unknown };
    if (typeof parsed.message === 'string') return parsed.message.slice(0, 120);
  } catch {
    /* plain text */
  }
  return body.replace(/\s+/g, ' ').trim().slice(0, 120);
}

// The providers' own words for "this webhook no longer exists". Only these
// mark a webhook broken: a 403 page from a CDN in front of Discord (our address
// blocked for a while) must not mark every member's webhook dead in one pass.
const DISCORD_GONE_CODES = new Set([10015 /* Unknown Webhook */, 50027 /* Invalid Webhook Token */]);
const SLACK_GONE = new Set([
  'invalid_token',
  'no_service',
  'no_service_id',
  'no_team',
  'team_disabled',
  'channel_not_found',
  'channel_is_archived',
  'action_prohibited',
]);

function providerSaysGone(provider: WebhookProvider, body: string): boolean {
  if (provider === 'slack') return SLACK_GONE.has(body.trim());
  try {
    const parsed = JSON.parse(body) as { code?: unknown; message?: unknown };
    return (
      (typeof parsed.code === 'number' && DISCORD_GONE_CODES.has(parsed.code)) ||
      parsed.message === 'Unknown Webhook' ||
      parsed.message === 'Invalid Webhook Token'
    );
  } catch {
    return false;
  }
}

/** Turn a provider's non-2xx answer into a WebhookSendError a member can read. */
export function classifyWebhookFailure(
  provider: WebhookProvider,
  status: number,
  body: string,
  retryAfterHeader: string | null = null,
): WebhookSendError {
  const name = PROVIDER_NAME[provider];
  const snippet = providerReason(body);
  if (status === 429) {
    return new WebhookSendError(`${name} is rate-limiting this webhook; it will be retried.`, {
      status,
      retryable: true,
      broken: false,
      retryAfterMs: retryAfterMs(retryAfterHeader, body),
    });
  }
  if (status >= 500) {
    return new WebhookSendError(`${name} had a server error (${status}); it will be retried.`, {
      status,
      retryable: true,
      broken: false,
    });
  }
  if (status === 401 || status === 403 || status === 404 || status === 410) {
    if (providerSaysGone(provider, body)) {
      return new WebhookSendError(
        `${name} says this webhook no longer works (${status}${snippet ? `: ${snippet}` : ''}). ` +
          'It was probably deleted, or its channel removed or archived.',
        { status, retryable: false, broken: true },
      );
    }
    // Not the provider's own answer (a CDN page, a block on our address):
    // nothing about this member's webhook is known, so try again later.
    return new WebhookSendError(`${name} could not be reached properly (${status}); it will be retried.`, {
      status,
      retryable: true,
      broken: false,
    });
  }
  if (status >= 300 && status < 400) {
    return new WebhookSendError(`${name} answered with a redirect (${status}), which a webhook never does.`, {
      status,
      retryable: false,
      broken: false,
    });
  }
  return new WebhookSendError(`${name} refused the message (${status}${snippet ? `: ${snippet}` : ''}).`, {
    status,
    retryable: false,
    broken: false,
  });
}

export const WEBHOOK_TIMEOUT_MS = 10_000;

/** POST one message to a saved webhook. Resolves on 2xx; throws WebhookSendError otherwise. */
export async function postWebhook(
  url: string,
  body: Record<string, unknown>,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<void> {
  const parsed = parseWebhookUrl(url);
  if (!parsed.ok) {
    // A stored address that no longer passes the rules is never posted to.
    throw new WebhookSendError('Not a Discord or Slack webhook address.', { status: null, retryable: false, broken: true });
  }
  const fetchImpl = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl(parsed.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'ZeroGEX-WallAlerts/1.0 (+https://zerogex.io)' },
      body: JSON.stringify(body),
      redirect: 'manual',
      signal: AbortSignal.timeout(opts.timeoutMs ?? WEBHOOK_TIMEOUT_MS),
    });
  } catch (err) {
    const reason = (err as Error)?.name === 'TimeoutError' ? 'did not answer in time' : 'could not be reached';
    throw new WebhookSendError(`${PROVIDER_NAME[parsed.provider]} ${reason}; it will be retried.`, {
      status: null,
      retryable: true,
      broken: false,
    });
  }
  const text = await res.text().catch(() => '');
  if (res.status >= 200 && res.status < 300) return;
  throw classifyWebhookFailure(parsed.provider, res.status, text, res.headers.get('retry-after'));
}

// ── Who gets what (the worker's plan) ───────────────────────────────────────

export interface WebhookMember {
  id: string;
  tier: string | null;
  deleted_at: string | null;
}

export interface WebhookDestination {
  user_id: string;
  url: string;
  provider: WebhookProvider;
  /** Set when the provider said the webhook is gone; cleared by a new save or a passing test. */
  failed_at: string | null;
  /** Why the last post or test did not land, when it did not; cleared when one does. */
  last_error?: string | null;
}

export type WebhookDisposition =
  | { action: 'send'; member: WebhookMember; webhook: WebhookDestination; rows: QueuedWallAlert[] }
  | { action: 'cancel'; rows: QueuedWallAlert[]; reason: string; purgeUser?: string };

/**
 * Decide every queued webhook row's fate: the email worker's rules
 * (core/wallAlertsDelivery.ts) less the email-only one, plus the webhook's own.
 *
 * * Unknown member: cancelled, never purged (a wrong AUTH_DB_PATH looks the same).
 * * Deleted account: cancelled and purged.
 * * Plan without wall alerts: cancelled, rules kept.
 * * No webhook saved (removed after the alert queued): cancelled.
 * * Webhook known to be broken: cancelled rather than posted to a dead
 *   address every pass until the member saves a new one.
 * * The same wall event twice in a pass (overlapping rules): one post.
 */
export function planWebhookDeliveries(
  rows: readonly QueuedWallAlert[],
  members: ReadonlyMap<string, WebhookMember>,
  webhooks: ReadonlyMap<string, WebhookDestination>,
  maxPerMessage = MAX_ALERTS_PER_WEBHOOK_MESSAGE,
): WebhookDisposition[] {
  const byUser = new Map<string, QueuedWallAlert[]>();
  for (const row of rows) {
    const list = byUser.get(row.end_user);
    if (list) list.push(row);
    else byUser.set(row.end_user, [row]);
  }
  const out: WebhookDisposition[] = [];
  for (const [userId, userRows] of byUser) {
    const sorted = [...userRows].sort(
      (a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id - b.id,
    );
    const member = members.get(userId);
    if (!member) {
      out.push({ action: 'cancel', rows: sorted, reason: 'unknown recipient' });
      continue;
    }
    if (member.deleted_at) {
      out.push({ action: 'cancel', rows: sorted, reason: 'account deleted', purgeUser: userId });
      continue;
    }
    if (!tierIncludesWallAlerts(member.tier)) {
      out.push({ action: 'cancel', rows: sorted, reason: 'plan does not include wall alerts' });
      continue;
    }
    const webhook = webhooks.get(userId);
    if (!webhook) {
      out.push({ action: 'cancel', rows: sorted, reason: 'no Discord or Slack webhook saved' });
      continue;
    }
    if (webhook.failed_at) {
      out.push({ action: 'cancel', rows: sorted, reason: `webhook not working since ${webhook.failed_at}` });
      continue;
    }
    const { unique, dupes } = splitDuplicateEvents(sorted);
    if (dupes.length) out.push({ action: 'cancel', rows: dupes, reason: 'duplicate in batch' });
    for (let i = 0; i < unique.length; i += maxPerMessage) {
      out.push({ action: 'send', member, webhook, rows: unique.slice(i, i + maxPerMessage) });
    }
  }
  return out;
}
