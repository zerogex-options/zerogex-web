'use client';

/**
 * Wall alerts — /account/alerts.
 *
 * Top to bottom: today's walls with their strength (each with an "Alert me"
 * shortcut), the member's alerts (toggle / edit / delete), the editor, recent
 * alerts, this browser's desktop-notification switch, and how it works.
 *
 * The editor shows a live preview — "today's SPX put wall is Strong, 88th
 * percentile; this alert would fire" — so the strength filter is never an
 * abstract number. Every limit and threshold comes from /api/alerts/walls/config
 * so this page cannot drift from the detector.
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BellPlus,
  BellRing,
  Check,
  ChevronDown,
  Mail,
  MessageSquare,
  Monitor,
  Pencil,
  Trash2,
  Webhook,
  X,
} from 'lucide-react';
import { useApiData } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import { hasTierAccess, normalizeTier } from '@/core/auth';
import { useLanguage, usePageT } from '@/core/LanguageContext';
import {
  DEFAULT_RULE_INPUT,
  STRENGTH_STOPS,
  TOUCH_OPTIONS_BP,
  WALL_CHANNELS,
  WALL_EVENT_KINDS,
  effectiveTouchBp,
  fmtEtDayTime,
  fmtPrice,
  fmtStrike,
  fmtTouchPct,
  passesStrengthFloor,
  ruleInputProblem,
  ruleToInput,
  strengthTierFor,
  touchAmount,
  type LiveWallSide,
  type LiveWallsResponse,
  type LiveWallsRow,
  type WallAlertFeedResponse,
  type WallAlertProfileConfig,
  type WallAlertRule,
  type WallAlertRuleInput,
  type WallAlertsConfig,
  type WallChannel,
  type WallProfile,
  type WallRuleSide,
  type WallSide,
} from '@/core/wallAlerts';
import { wallAlertCopyFor } from '@/core/wallAlertsCopy';
import type { AlertWebhookView } from '@/core/wallAlertWebhook';
import {
  desktopEnabled,
  desktopPermission,
  notifyDesktopPref,
  setDesktopEnabled,
  subscribeDesktopPref,
  type DesktopPermission,
} from '@/core/wallAlertsPrefs';
import { WallAlertRow, fmtWhen } from '@/components/wallAlerts/WallAlertRow';
import { dict } from './WallAlertsClient.i18n';

type T = (key: string, vars?: Record<string, string | number>) => string;

interface RulesResponse {
  rules: WallAlertRule[];
}

const FALLBACK_SYMBOLS = ['SPY', 'QQQ', 'SPX', 'NDX'];
const PROFILE_ORDER: WallProfile[] = ['responsive', 'balanced', 'conservative'];

const card = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
} as const;

async function apiSend(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  if (!res.ok) {
    const detail =
      payload && typeof payload === 'object' && 'detail' in payload && typeof (payload as { detail: unknown }).detail === 'string'
        ? (payload as { detail: string }).detail
        : null;
    const err = new Error(detail ?? `HTTP ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return payload;
}

/**
 * Call one of the member's own account routes (the Discord / Slack webhook):
 * those are Next routes, not the proxied API, and want the CSRF token.
 * Resolves with the status and body either way; the caller words the outcome.
 */
async function accountSend(
  path: string,
  method: 'PUT' | 'POST' | 'DELETE',
  body?: unknown,
): Promise<{ ok: boolean; status: number; payload: Record<string, unknown> | null }> {
  const csrfRes = await fetch('/api/auth/csrf', { credentials: 'include', cache: 'no-store' });
  const csrf = (await csrfRes.json().catch(() => ({}))) as { csrfToken?: string };
  const res = await fetch(path, {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf.csrfToken ?? '' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const payload = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { ok: res.ok, status: res.status, payload };
}

const WEBHOOK_PATH = '/api/account/alert-webhook';

/** Where the Discord / Slack channel stands for this member. */
type WebhookChannelState = 'unavailable' | 'needs_setup' | 'ready';

export default function WallAlertsClient({
  tier,
  emailVerified,
  initialSymbol,
  initialSide,
}: {
  tier: string;
  emailVerified: boolean;
  initialSymbol: string | null;
  initialSide: string | null;
}) {
  const t = usePageT(dict) as T;
  const { locale } = useLanguage();
  const copy = useMemo(() => wallAlertCopyFor(locale), [locale]);
  const entitled = hasTierAccess(normalizeTier(tier), 'basic');

  const config = useApiData<WallAlertsConfig>('/api/alerts/walls/config', { refreshInterval: 0, enabled: entitled });
  const rules = useApiData<RulesResponse>('/api/alerts/walls/rules', { refreshInterval: 0, enabled: entitled });
  const live = useApiData<LiveWallsResponse>('/api/alerts/walls/live', { refreshInterval: 30_000, enabled: entitled });
  const feed = useApiData<WallAlertFeedResponse>('/api/alerts/walls/feed?limit=20', {
    refreshInterval: 30_000,
    enabled: entitled,
  });
  const webhook = useApiData<{ webhook: AlertWebhookView | null }>(WEBHOOK_PATH, { refreshInterval: 0, enabled: entitled });

  const symbols = config.data?.symbols?.length ? config.data.symbols : FALLBACK_SYMBOLS;
  const maxRules = config.data?.max_rules ?? 25;
  const smsAvailable = Boolean(config.data?.channels?.find((c) => c.id === 'sms')?.available);
  // The API must offer the channel, and the member must have a webhook saved.
  const webhookOffered = Boolean(config.data?.channels?.find((c) => c.id === 'webhook')?.available);
  const webhookChannel: WebhookChannelState = !webhookOffered
    ? 'unavailable'
    : webhook.data?.webhook
      ? 'ready'
      : 'needs_setup';
  const profiles = config.data?.profiles ?? null;
  const touchOptions = config.data?.touch_options_bp?.length ? config.data.touch_options_bp : TOUCH_OPTIONS_BP;

  // Editor state: null = closed; { id: null } = creating; { id } = editing.
  const [editing, setEditing] = useState<{ id: number | null; input: WallAlertRuleInput } | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const openEditor = useCallback((id: number | null, input: WallAlertRuleInput) => {
    setBanner(null);
    setEditing({ id, input });
    // After paint, so the panel exists to scroll to.
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, []);

  // Deep link: /account/alerts?symbol=SPX&side=put opens a prefilled editor once.
  // Waits for the server's symbol list, so a symbol alerts were turned on for
  // after FALLBACK_SYMBOLS was written (NVDA) opens as itself, not as SPX.
  const deepLinked = useRef(false);
  const configSettled = !config.loading;
  useEffect(() => {
    if (deepLinked.current || !entitled || !configSettled) return;
    const sym = (initialSymbol || '').toUpperCase();
    if (!sym) return;
    deepLinked.current = true;
    const side: WallRuleSide = initialSide === 'call' || initialSide === 'put' ? initialSide : 'both';
    const symbol = symbols.includes(sym) ? sym : sym === 'ES' ? 'SPX' : sym === 'NQ' ? 'NDX' : 'SPX';
    openEditor(null, { ...DEFAULT_RULE_INPUT, symbol, side });
  }, [entitled, configSettled, symbols, initialSymbol, initialSide, openEditor]);

  const ruleList = useMemo(() => rules.data?.rules ?? [], [rules.data]);
  const atLimit = ruleList.length >= maxRules;

  const save = useCallback(async () => {
    if (!editing) return;
    const problem = ruleInputProblem(editing.input);
    if (problem) {
      setBanner(problem === 'events' ? t('needEvents') : t('needChannels'));
      return;
    }
    setBusy(true);
    setBanner(null);
    try {
      if (editing.id === null) {
        await apiSend('/api/alerts/walls/rules', 'POST', editing.input);
      } else {
        await apiSend(`/api/alerts/walls/rules/${editing.id}`, 'PATCH', editing.input);
      }
      setEditing(null);
      rules.refetch();
    } catch (err) {
      const e = err as Error & { status?: number };
      setBanner(e.status === 409 ? t('limitReached', { max: maxRules }) : e.message || t('saveError'));
    } finally {
      setBusy(false);
    }
  }, [editing, rules, t, maxRules]);

  const toggleRule = useCallback(
    async (rule: WallAlertRule) => {
      setBanner(null);
      try {
        // An ended today-only alert is turned back on, which re-arms it for
        // the next session; anything else flips between on and paused.
        await apiSend(`/api/alerts/walls/rules/${rule.id}`, 'PATCH', { enabled: rule.ended ? true : !rule.enabled });
        rules.refetch();
      } catch {
        setBanner(t('saveError'));
      }
    },
    [rules, t],
  );

  const deleteRule = useCallback(
    async (rule: WallAlertRule) => {
      if (!window.confirm(t('deleteConfirm'))) return;
      setBanner(null);
      try {
        await apiSend(`/api/alerts/walls/rules/${rule.id}`, 'DELETE');
        if (editing?.id === rule.id) setEditing(null);
        rules.refetch();
      } catch {
        setBanner(t('deleteError'));
      }
    },
    [editing, rules, t],
  );

  const markAllRead = useCallback(async () => {
    try {
      await apiSend('/api/alerts/walls/feed/read', 'POST', {});
      feed.refetch();
    } catch {
      /* the next poll shows the true state */
    }
  }, [feed]);

  if (!entitled) {
    return (
      <Shell t={t}>
        <section className="rounded-2xl p-6" style={card}>
          <div className="flex items-start gap-3">
            <BellRing className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-info)' }} />
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{t('upgradeTitle')}</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1 leading-relaxed">{t('upgradeBody')}</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-2">{t('pausedNote')}</p>
              <Link
                href="/pricing"
                className="inline-block mt-4 text-xs font-semibold px-4 py-2 rounded-full"
                style={{ backgroundColor: 'var(--color-info)', color: 'var(--color-on-info, #ffffff)' }}
              >
                {t('upgradeCta')}
              </Link>
            </div>
          </div>
        </section>
        <HowItWorks t={t} />
      </Shell>
    );
  }

  return (
    <Shell t={t}>
      {banner ? (
        <div
          className="rounded-xl p-3 mb-4 flex items-start gap-2 text-xs"
          style={{ backgroundColor: 'var(--color-bear-soft)', color: 'var(--color-bear)', border: '1px solid var(--color-bear)' }}
          role="alert"
        >
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span className="leading-snug flex-1">{banner}</span>
          <button onClick={() => setBanner(null)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : null}

      <LiveWalls
        t={t}
        copy={copy}
        data={live.data}
        loading={live.loading && !live.data}
        onAlert={(symbol, side) => openEditor(null, { ...DEFAULT_RULE_INPUT, symbol, side })}
        disabled={atLimit}
      />

      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t('yourAlerts')}</h2>
          <button
            onClick={() => openEditor(null, { ...DEFAULT_RULE_INPUT })}
            disabled={atLimit}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full transition-opacity"
            style={{
              backgroundColor: 'var(--color-info)',
              color: 'var(--color-on-info, #ffffff)',
              opacity: atLimit ? 0.5 : 1,
            }}
            title={atLimit ? t('limitReached', { max: maxRules }) : undefined}
          >
            <BellPlus className="w-3.5 h-3.5" /> {t('newAlert')}
          </button>
        </div>

        {editing ? (
          <div ref={editorRef} style={{ scrollMarginTop: 'calc(var(--zgx-header-height, 56px) + 16px)' }}>
            <RuleEditor
              t={t}
              copy={copy}
              value={editing.input}
              isNew={editing.id === null}
              symbols={symbols}
              smsAvailable={smsAvailable}
              webhookChannel={webhookChannel}
              emailVerified={emailVerified}
              profiles={profiles}
              touchOptions={touchOptions}
              todayOnlyEnds={fmtEtDayTime(config.data?.today_only?.ends_at, locale)}
              live={live.data}
              busy={busy}
              onChange={(input) => setEditing((prev) => (prev ? { ...prev, input } : prev))}
              onCancel={() => {
                setEditing(null);
                setBanner(null);
              }}
              onSave={save}
            />
          </div>
        ) : null}

        {rules.loading && !rules.data ? (
          <LoadingSpinner />
        ) : rules.error && !rules.data ? (
          <div className="rounded-2xl p-5 text-sm flex items-center justify-between" style={card}>
            <span className="text-[var(--color-text-secondary)]">{t('loadError')}</span>
            <button onClick={rules.refetch} className="text-xs font-semibold text-[var(--color-info)]">
              {t('retry')}
            </button>
          </div>
        ) : ruleList.length === 0 && !editing ? (
          <EmptyState t={t} onPreset={(input) => openEditor(null, input)} />
        ) : (
          <div className="space-y-3">
            {ruleList.map((rule) => (
              <RuleCard
                key={rule.id}
                t={t}
                copy={copy}
                locale={locale}
                rule={rule}
                live={live.data}
                profiles={profiles}
                onToggle={() => toggleRule(rule)}
                onEdit={() => openEditor(rule.id, ruleToInput(rule))}
                onDelete={() => deleteRule(rule)}
              />
            ))}
          </div>
        )}
      </section>

      <RecentAlerts t={t} copy={copy} locale={locale} data={feed.data} onMarkAllRead={markAllRead} />

      {webhookOffered ? (
        <WebhookCard t={t} locale={locale} saved={webhook.data?.webhook ?? null} onChanged={webhook.refetch} />
      ) : null}

      <DesktopToggle t={t} />

      <HowItWorks t={t} />
    </Shell>
  );
}

function Shell({ t, children }: { t: T; children: React.ReactNode }) {
  return (
    <main className="min-h-screen">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <Link
            href="/account"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t('backToAccount')}
          </Link>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mt-3">{t('title')}</h1>
          <p className="text-sm text-[var(--color-text-secondary)] max-w-2xl mt-2 leading-relaxed">{t('description')}</p>
        </div>
        {children}
      </div>
    </main>
  );
}

// ── Live walls ──────────────────────────────────────────────────────────────

function LiveWalls({
  t,
  copy,
  data,
  loading,
  onAlert,
  disabled,
}: {
  t: T;
  copy: ReturnType<typeof wallAlertCopyFor>;
  data: LiveWallsResponse | null;
  loading: boolean;
  onAlert: (symbol: string, side: WallSide) => void;
  disabled: boolean;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t('liveTitle')}</h2>
      <p className="text-xs text-[var(--color-text-secondary)] mt-1 mb-3 leading-snug max-w-2xl">{t('liveSubtitle')}</p>
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(data?.symbols ?? []).map((row) => (
            <LiveCard key={row.symbol} t={t} copy={copy} row={row} onAlert={onAlert} disabled={disabled} />
          ))}
        </div>
      )}
    </section>
  );
}

function TierBadge({ t, copy, side }: { t: T; copy: ReturnType<typeof wallAlertCopyFor>; side: LiveWallSide }) {
  const tier = side.strength_tier ?? strengthTierFor(side.strength_pctile);
  if (!tier || side.strength_pctile === null) {
    return <span className="text-[10px] text-[var(--color-text-secondary)]">{t('unrated')}</span>;
  }
  const strong = tier === 'strong' || tier === 'very_strong';
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded tabular-nums"
      style={{
        backgroundColor: strong ? 'var(--color-info-soft)' : 'var(--color-surface-muted, transparent)',
        color: strong ? 'var(--color-info)' : 'var(--color-text-secondary)',
        border: strong ? 'none' : '1px solid var(--color-border)',
      }}
      title={copy.percentile(Math.round(side.strength_pctile))}
    >
      {copy.tier[tier]} · {Math.round(side.strength_pctile)}
    </span>
  );
}

function LiveCard({
  t,
  copy,
  row,
  onAlert,
  disabled,
}: {
  t: T;
  copy: ReturnType<typeof wallAlertCopyFor>;
  row: LiveWallsRow;
  onAlert: (symbol: string, side: WallSide) => void;
  disabled: boolean;
}) {
  const line = (side: WallSide, label: string, wall: LiveWallSide | null) => (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div className="min-w-0">
        <div className="text-[11px] text-[var(--color-text-secondary)]">{label}</div>
        {wall ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">{fmtStrike(wall.strike)}</span>
            <TierBadge t={t} copy={copy} side={wall} />
            {wall.distance !== null ? (
              <span className="text-[10px] text-[var(--color-text-secondary)] tabular-nums">
                {wall.distance >= 0
                  ? t('away', { dist: fmtPrice(wall.distance) })
                  : t('through', { dist: fmtPrice(Math.abs(wall.distance)) })}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="text-sm text-[var(--color-text-secondary)]">{t('noWall')}</div>
        )}
      </div>
      <button
        onClick={() => onAlert(row.symbol, side)}
        disabled={disabled || !wall}
        className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap transition-opacity"
        style={{
          border: '1px solid var(--color-info)',
          color: 'var(--color-info)',
          opacity: disabled || !wall ? 0.4 : 1,
        }}
      >
        {t('alertMe')}
      </button>
    </div>
  );
  return (
    <div className="rounded-2xl p-4" style={card}>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-base font-bold text-[var(--color-text-primary)]">{row.symbol}</span>
        <span className="text-xs tabular-nums text-[var(--color-text-secondary)]">
          {row.stale ? (
            <span style={{ color: 'var(--color-warning)' }}>{t('stale')}</span>
          ) : (
            <>
              {t('price')} <span className="text-[var(--color-text-primary)] font-medium">{fmtPrice(row.price)}</span>
            </>
          )}
        </span>
      </div>
      {line('call', t('callWall'), row.call)}
      <div className="border-t border-[var(--color-border)]" />
      {line('put', t('putWall'), row.put)}
    </div>
  );
}

// ── Rules ───────────────────────────────────────────────────────────────────

function strengthLabel(t: T, copy: ReturnType<typeof wallAlertCopyFor>, floor: number): string {
  if (!floor) return t('strengthAny');
  const tier = strengthTierFor(floor);
  return tier ? t('strengthAtLeast', { tier: copy.tier[tier] }) : t('strengthAny');
}

function RuleCard({
  t,
  copy,
  locale,
  rule,
  live,
  profiles,
  onToggle,
  onEdit,
  onDelete,
}: {
  t: T;
  copy: ReturnType<typeof wallAlertCopyFor>;
  locale: string;
  rule: WallAlertRule;
  live: LiveWallsResponse | null;
  profiles: readonly WallAlertProfileConfig[] | null;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const events = WALL_EVENT_KINDS.filter((k) => rule.events?.[k]).map((k) => t(`summaryEvents_${k}`));
  const channelIcons = WALL_CHANNELS.filter((c) => rule.channels?.[c]);
  const row = live?.symbols.find((r) => r.symbol === rule.symbol) ?? null;
  const running = rule.enabled && !rule.ended;
  const ends = fmtEtDayTime(rule.ends_at, locale);
  return (
    <div className="rounded-2xl p-4 relative overflow-hidden" style={{ ...card, opacity: running ? 1 : 0.65 }}>
      <div
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: running ? 'var(--color-info)' : 'var(--color-border)' }}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3 pl-1">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">
            {rule.symbol} · {t(`summarySides_${rule.side}`)}
          </div>
          <div className="text-xs text-[var(--color-text-secondary)] mt-1 leading-snug">
            {events.join(' · ')} — {strengthLabel(t, copy, rule.min_strength_pctile)} · {t(`profile_${rule.profile}`)}
            {typeof rule.touch_bp === 'number' ? ` · ${t('summaryTouch', { pct: fmtTouchPct(rule.touch_bp) })}` : ''}
          </div>
          <div className="flex items-center gap-2 mt-2 text-[10px] text-[var(--color-text-secondary)]">
            {channelIcons.map((c) => (
              <ChannelIcon key={c} channel={c} />
            ))}
            <span>
              {rule.last_triggered_at ? t('lastAlert', { time: fmtWhen(rule.last_triggered_at, locale) }) : t('noAlertsYet')}
            </span>
            {rule.today_only ? (
              <span className="font-semibold" style={{ color: rule.ended ? 'var(--color-text-secondary)' : 'var(--color-warning)' }}>
                · {rule.ended ? t('endedOn', { when: ends }) : t('todayOnlyUntil', { when: ends })}
              </span>
            ) : null}
          </div>
          {row && running ? (
            <RulePreviewLine
              t={t}
              copy={copy}
              rule={rule}
              row={row}
              touchBp={effectiveTouchBp(rule.profile, rule.touch_bp, profiles)}
            />
          ) : null}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onToggle}
            role="switch"
            aria-checked={running}
            title={rule.ended ? t('runAgainHint') : undefined}
            className="text-[10px] font-semibold px-2 py-1 rounded-full"
            style={{
              backgroundColor: running ? 'var(--color-bull-soft)' : 'transparent',
              color: running ? 'var(--color-bull)' : 'var(--color-text-secondary)',
              border: running ? 'none' : '1px solid var(--color-border)',
            }}
          >
            {rule.ended ? t('runAgain') : rule.enabled ? t('on') : t('off')}
          </button>
          <button onClick={onEdit} aria-label={t('edit')} className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} aria-label={t('delete')} className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-bear)]">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ChannelIcon({ channel }: { channel: WallChannel }) {
  const Icon = channel === 'email' ? Mail : channel === 'sms' ? MessageSquare : channel === 'webhook' ? Webhook : BellRing;
  return <Icon className="w-3 h-3" aria-label={channel} />;
}

/** The touch band on a wall in price terms: "$0.39" or "3.9 points". */
function touchAmountText(t: T, symbol: string, strike: number, bp: number): string {
  const amount = touchAmount(symbol, strike, bp);
  return amount.points ? `${amount.text} ${t('pointsUnit')}` : amount.text;
}

function previewFor(
  t: T,
  copy: ReturnType<typeof wallAlertCopyFor>,
  symbol: string,
  side: WallSide,
  floor: number,
  row: LiveWallsRow | null,
  touchBp: number,
): { text: string; ok: boolean } {
  const wall = row ? row[side] : null;
  const sideText = copy.side[side];
  if (!wall) return { text: t('preview_none', { symbol, side: sideText }), ok: false };
  const tier = wall.strength_tier ?? strengthTierFor(wall.strength_pctile);
  if (!tier || wall.strength_pctile === null) {
    return { text: t('preview_unrated', { symbol, side: sideText, strike: fmtStrike(wall.strike) }), ok: floor === 0 };
  }
  const vars = {
    symbol,
    side: sideText,
    strike: fmtStrike(wall.strike),
    tier: copy.tier[tier],
    pctile: copy.percentile(Math.round(wall.strength_pctile)),
    zone: `${touchAmountText(t, symbol, wall.strike, touchBp)} (${fmtTouchPct(touchBp)})`,
  };
  const ok = passesStrengthFloor(floor, wall.strength_pctile);
  return { text: t(ok ? 'preview_match' : 'preview_filtered', vars), ok };
}

function RulePreviewLine({
  t,
  copy,
  rule,
  row,
  touchBp,
}: {
  t: T;
  copy: ReturnType<typeof wallAlertCopyFor>;
  rule: WallAlertRule;
  row: LiveWallsRow;
  touchBp: number;
}) {
  const sides: WallSide[] = rule.side === 'both' ? ['call', 'put'] : [rule.side];
  return (
    <div className="mt-2 space-y-0.5">
      {sides.map((side) => {
        const p = previewFor(t, copy, rule.symbol, side, rule.min_strength_pctile, row, touchBp);
        return (
          <div key={side} className="text-[11px] leading-snug" style={{ color: p.ok ? 'var(--color-text-secondary)' : 'var(--color-warning)' }}>
            {p.text}
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ t, onPreset }: { t: T; onPreset: (input: WallAlertRuleInput) => void }) {
  const presets: Array<{ label: string; input: WallAlertRuleInput }> = [
    {
      label: t('presetStrongSpx'),
      input: { ...DEFAULT_RULE_INPUT, symbol: 'SPX', side: 'put', min_strength_pctile: 75, channels: { in_app: true, email: true, webhook: false, sms: false } },
    },
    { label: t('presetSpyBoth'), input: { ...DEFAULT_RULE_INPUT, symbol: 'SPY', side: 'both' } },
    {
      label: t('presetQqqBreak'),
      input: { ...DEFAULT_RULE_INPUT, symbol: 'QQQ', side: 'both', events: { hit: false, break: true, hold: false } },
    },
  ];
  return (
    <div className="p-6 rounded-2xl text-center" style={{ ...card, border: '1px dashed var(--color-border)' }}>
      <div
        className="mx-auto mb-3 flex items-center justify-center w-12 h-12 rounded-full"
        style={{ backgroundColor: 'var(--color-info-soft)', color: 'var(--color-info)' }}
      >
        <BellPlus className="w-5 h-5" />
      </div>
      <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">{t('emptyTitle')}</h3>
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">{t('emptyBody')}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => onPreset(p.input)}
            className="text-xs font-medium px-3 py-2 rounded-full"
            style={{ border: '1px solid var(--color-info)', color: 'var(--color-info)' }}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Editor ──────────────────────────────────────────────────────────────────

function Segmented<V extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: V; label: string }>;
  value: V;
  onChange: (v: V) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-xl p-0.5" style={{ border: '1px solid var(--color-border)' }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{
              backgroundColor: active ? 'var(--color-info)' : 'transparent',
              color: active ? 'var(--color-on-info, #ffffff)' : 'var(--color-text-primary)',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">{children}</div>;
}

function RuleEditor({
  t,
  copy,
  value,
  isNew,
  symbols,
  smsAvailable,
  webhookChannel,
  emailVerified,
  profiles,
  touchOptions,
  todayOnlyEnds,
  live,
  busy,
  onChange,
  onCancel,
  onSave,
}: {
  t: T;
  copy: ReturnType<typeof wallAlertCopyFor>;
  value: WallAlertRuleInput;
  isNew: boolean;
  symbols: string[];
  smsAvailable: boolean;
  webhookChannel: WebhookChannelState;
  emailVerified: boolean;
  profiles: readonly WallAlertProfileConfig[] | null;
  touchOptions: readonly number[];
  /** When a today-only alert saved now would stop, formatted; '' if unknown. */
  todayOnlyEnds: string;
  live: LiveWallsResponse | null;
  busy: boolean;
  onChange: (v: WallAlertRuleInput) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const set = (patch: Partial<WallAlertRuleInput>) => onChange({ ...value, ...patch });
  const row = live?.symbols.find((r) => r.symbol === value.symbol) ?? null;
  const sides: WallSide[] = value.side === 'both' ? ['call', 'put'] : [value.side];
  const floorTier = strengthTierFor(value.min_strength_pctile);
  const autoTouchBp = effectiveTouchBp(value.profile, null, profiles);
  const touchBp = effectiveTouchBp(value.profile, value.touch_bp, profiles);
  // The tolerance in price terms on the first wall this rule watches, so
  // "0.05%" reads as "about $0.39" before the member commits to it.
  const exampleSide = sides.find((side) => row?.[side]);
  const exampleWall = exampleSide ? row?.[exampleSide] : null;
  const touchExample =
    exampleSide && exampleWall
      ? t('touchExample', {
          symbol: value.symbol,
          side: copy.side[exampleSide],
          strike: fmtStrike(exampleWall.strike),
          pct: fmtTouchPct(touchBp),
          amount: touchAmountText(t, value.symbol, exampleWall.strike, touchBp),
        })
      : null;

  return (
    <div className="rounded-2xl p-5 mb-4" style={{ ...card, border: '1px solid var(--color-info)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{isNew ? t('createTitle') : t('editTitle')}</h3>
        <button onClick={onCancel} aria-label={t('cancel')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <FieldLabel>{t('symbol')}</FieldLabel>
            <Segmented
              label={t('symbol')}
              value={value.symbol}
              onChange={(symbol) => set({ symbol })}
              options={symbols.map((s) => ({ value: s, label: s }))}
            />
            <p className="text-[10px] text-[var(--color-text-secondary)] mt-2 leading-snug">{t('futuresHint')}</p>
          </div>
          <div>
            <FieldLabel>{t('wall')}</FieldLabel>
            <Segmented<WallRuleSide>
              label={t('wall')}
              value={value.side}
              onChange={(side) => set({ side })}
              options={[
                { value: 'call', label: t('side_call') },
                { value: 'put', label: t('side_put') },
                { value: 'both', label: t('side_both') },
              ]}
            />
          </div>
        </div>

        <div>
          <FieldLabel>{t('alertWhen')}</FieldLabel>
          <div className="space-y-2">
            {WALL_EVENT_KINDS.map((kind) => (
              <label key={kind} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value.events[kind]}
                  onChange={() => set({ events: { ...value.events, [kind]: !value.events[kind] } })}
                  className="mt-0.5 w-4 h-4"
                  style={{ accentColor: 'var(--color-info)' }}
                />
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-[var(--color-text-primary)]">{t(`event_${kind}`)}</span>
                  <span className="block text-[11px] text-[var(--color-text-secondary)] leading-snug">{t(`event_${kind}_desc`)}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <FieldLabel>{t('strength')}</FieldLabel>
            <span className="text-xs font-semibold text-[var(--color-text-primary)] tabular-nums">
              {value.min_strength_pctile === 0
                ? t('strengthAny')
                : `${floorTier ? copy.tier[floorTier] : ''} · ≥ ${copy.percentile(value.min_strength_pctile)}`}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={95}
            step={5}
            value={value.min_strength_pctile}
            onChange={(e) => set({ min_strength_pctile: Number(e.target.value) })}
            className="w-full"
            style={{ accentColor: 'var(--color-info)' }}
            aria-label={t('strength')}
          />
          <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] mt-0.5">
            {STRENGTH_STOPS.map((stop) => (
              <button
                key={stop.pctile}
                type="button"
                onClick={() => set({ min_strength_pctile: stop.pctile })}
                className="hover:text-[var(--color-text-primary)]"
              >
                {stop.tier ? copy.tier[stop.tier] : t('strengthAny')}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-2 leading-snug">{t('strengthDesc')}</p>
        </div>

        <div>
          <FieldLabel>{t('sensitivity')}</FieldLabel>
          <div className="grid gap-2 sm:grid-cols-3">
            {PROFILE_ORDER.map((profile) => {
              const active = value.profile === profile;
              return (
                <button
                  key={profile}
                  type="button"
                  onClick={() => set({ profile })}
                  aria-pressed={active}
                  className="text-left rounded-xl p-3 transition-colors"
                  style={{
                    border: `1px solid ${active ? 'var(--color-info)' : 'var(--color-border)'}`,
                    backgroundColor: active ? 'var(--color-info-soft)' : 'transparent',
                  }}
                >
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-primary)]">
                    {active ? <Check className="w-3 h-3" style={{ color: 'var(--color-info)' }} /> : null}
                    {t(`profile_${profile}`)}
                  </span>
                  <span className="block text-[11px] text-[var(--color-text-secondary)] mt-1 leading-snug">
                    {t(`profile_${profile}_desc`)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <FieldLabel>{t('touchTitle')}</FieldLabel>
          <Segmented<string>
            label={t('touchTitle')}
            value={value.touch_bp === null ? 'auto' : String(value.touch_bp)}
            onChange={(v) => set({ touch_bp: v === 'auto' ? null : Number(v) })}
            options={[
              { value: 'auto', label: t('touchAuto', { pct: fmtTouchPct(autoTouchBp) }) },
              ...touchOptions.map((bp) => ({ value: String(bp), label: fmtTouchPct(bp) })),
            ]}
          />
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-2 leading-snug">{t('touchDesc')}</p>
          {touchExample ? (
            <p className="text-[11px] text-[var(--color-text-primary)] mt-1 leading-snug tabular-nums">{touchExample}</p>
          ) : null}
        </div>

        <div>
          <FieldLabel>{t('channels')}</FieldLabel>
          <div className="space-y-2">
            {WALL_CHANNELS.map((channel) => {
              const available =
                channel === 'sms' ? smsAvailable : channel === 'webhook' ? webhookChannel === 'ready' : true;
              const setUp = channel === 'webhook' && webhookChannel === 'needs_setup';
              // A rule still set to Discord / Slack after its webhook was
              // removed stays tickable, so it can be switched off.
              const togglable = available || (setUp && value.channels[channel]);
              return (
                <label
                  key={channel}
                  className="flex items-start gap-3"
                  style={{ cursor: togglable ? 'pointer' : 'not-allowed', opacity: available ? 1 : 0.55 }}
                >
                  <input
                    type="checkbox"
                    disabled={!togglable}
                    checked={(available || setUp) && value.channels[channel]}
                    onChange={() => set({ channels: { ...value.channels, [channel]: !value.channels[channel] } })}
                    className="mt-0.5 w-4 h-4"
                    style={{ accentColor: 'var(--color-info)' }}
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-primary)]">
                      <ChannelIcon channel={channel} /> {t(`channel_${channel}`)}
                      <span
                        className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: available ? 'var(--color-bull-soft)' : 'var(--color-warning-soft)',
                          color: available ? 'var(--color-bull)' : 'var(--color-warning)',
                        }}
                      >
                        {available ? t('live') : setUp ? t('setUpBelow') : t('comingSoon')}
                      </span>
                    </span>
                    <span className="block text-[11px] text-[var(--color-text-secondary)] leading-snug">
                      {setUp ? t('channel_webhook_needs') : t(`channel_${channel}_desc`)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {value.channels.email && !emailVerified ? (
            <p className="text-[11px] mt-2 leading-snug" style={{ color: 'var(--color-warning)' }}>
              {t('unverified')}
            </p>
          ) : null}
        </div>

        <div>
          <FieldLabel>{t('duration')}</FieldLabel>
          <Segmented<'always' | 'today'>
            label={t('duration')}
            value={value.today_only ? 'today' : 'always'}
            onChange={(v) => set({ today_only: v === 'today' })}
            options={[
              { value: 'always', label: t('duration_always') },
              { value: 'today', label: t('duration_today') },
            ]}
          />
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-2 leading-snug">
            {value.today_only
              ? todayOnlyEnds
                ? t('duration_today_desc', { when: todayOnlyEnds })
                : t('duration_today_desc_nodate')
              : t('saveHint')}
          </p>
        </div>

        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-info-soft)' }}>
          <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-info)' }}>
            {t('previewTitle')}
          </div>
          {sides.map((side) => {
            const p = previewFor(t, copy, value.symbol, side, value.min_strength_pctile, row, touchBp);
            return (
              <p key={side} className="text-xs leading-snug text-[var(--color-text-primary)]" style={{ opacity: p.ok ? 1 : 0.8 }}>
                {p.text}
              </p>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel} className="text-xs font-medium px-3 py-2 rounded-full text-[var(--color-text-secondary)]">
            {t('cancel')}
          </button>
          <button
            onClick={onSave}
            disabled={busy}
            className="text-xs font-semibold px-4 py-2 rounded-full"
            style={{ backgroundColor: 'var(--color-info)', color: 'var(--color-on-info, #ffffff)', opacity: busy ? 0.6 : 1 }}
          >
            {busy ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Recent alerts ───────────────────────────────────────────────────────────

function RecentAlerts({
  t,
  copy,
  locale,
  data,
  onMarkAllRead,
}: {
  t: T;
  copy: ReturnType<typeof wallAlertCopyFor>;
  locale: string;
  data: WallAlertFeedResponse | null;
  onMarkAllRead: () => void;
}) {
  const entries = data?.entries ?? [];
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t('recentTitle')}</h2>
        {data && data.unread > 0 ? (
          <button onClick={onMarkAllRead} className="text-xs font-medium text-[var(--color-info)] hover:underline">
            {t('markAllRead')}
          </button>
        ) : null}
      </div>
      <div className="rounded-2xl overflow-hidden" style={card}>
        {entries.length === 0 ? (
          <div className="p-5 text-xs text-[var(--color-text-secondary)]">{t('recentEmpty')}</div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {entries.map((entry) => (
              <li key={entry.id} className="px-4 py-3" style={{ backgroundColor: entry.read ? 'transparent' : 'var(--color-info-soft)' }}>
                <WallAlertRow entry={entry} copy={copy} locale={locale} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ── Desktop notifications ───────────────────────────────────────────────────

// The server (and hydration) render "unsupported / off"; the browser's real
// answer replaces it right after.
const serverPermission = (): DesktopPermission => 'unsupported';
const serverEnabled = () => false;

// ── Discord & Slack ─────────────────────────────────────────────────────────

/**
 * The member's Discord or Slack webhook: connect (we post a test message
 * before saving), re-test, replace, remove. The saved address only ever comes
 * back masked; delivery is scripts/wall-alerts-webhooks.mts.
 */
function WebhookCard({
  t,
  locale,
  saved,
  onChanged,
}: {
  t: T;
  locale: string;
  saved: AlertWebhookView | null;
  onChanged: () => void;
}) {
  const [url, setUrl] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [busy, setBusy] = useState<null | 'connect' | 'test' | 'remove'>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const showForm = !saved || replacing;

  const problemText = (payload: Record<string, unknown> | null): string => {
    const problem = typeof payload?.problem === 'string' ? payload.problem : null;
    const detail = typeof payload?.error === 'string' ? payload.error : '';
    if (problem === 'test_failed') return t('webhookTestFailed', { detail });
    if (problem) {
      const key = `webhookProblem_${problem}`;
      const text = t(key);
      if (text !== key) return text;
    }
    return detail || t('saveError');
  };

  const run = async (kind: 'connect' | 'test' | 'remove', action: () => Promise<void>) => {
    setBusy(kind);
    setNote(null);
    try {
      await action();
    } catch {
      setNote({ ok: false, text: t('saveError') });
    } finally {
      setBusy(null);
    }
  };

  const connect = () =>
    run('connect', async () => {
      const r = await accountSend(WEBHOOK_PATH, 'PUT', { url });
      if (r.ok) {
        setUrl('');
        setReplacing(false);
        setNote({ ok: true, text: t('webhookConnected') });
        onChanged();
      } else {
        setNote({ ok: false, text: problemText(r.payload) });
      }
    });
  const test = () =>
    run('test', async () => {
      const r = await accountSend(WEBHOOK_PATH, 'POST');
      setNote(r.ok ? { ok: true, text: t('webhookTestOk') } : { ok: false, text: problemText(r.payload) });
      onChanged();
    });
  const remove = () => {
    if (!window.confirm(t('webhookRemoveConfirm'))) return;
    void run('remove', async () => {
      await accountSend(WEBHOOK_PATH, 'DELETE');
      setReplacing(false);
      onChanged();
    });
  };

  return (
    <section className="rounded-2xl p-5 mb-6" style={card}>
      <div className="flex items-start gap-3">
        <Webhook className="w-4 h-4 mt-0.5 flex-shrink-0 text-[var(--color-text-secondary)]" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">{t('webhookTitle')}</div>
          {saved ? (
            <div className="mt-1 space-y-1">
              <div className="text-xs text-[var(--color-text-primary)] break-all">
                <span className="font-semibold">{t(`provider_${saved.provider}`)}</span> · {saved.masked}
              </div>
              {saved.failed_at ? (
                <p className="text-[11px] leading-snug" style={{ color: 'var(--color-warning)' }}>
                  {t('webhookBroken', { error: saved.last_error ?? '' })}
                </p>
              ) : saved.last_error ? (
                // Refused but not gone (say, a forum channel that needs a
                // thread): posting goes on, and the member sees why it fails.
                <p className="text-[11px] leading-snug" style={{ color: 'var(--color-warning)' }}>
                  {t('webhookRefused', { error: saved.last_error })}
                </p>
              ) : saved.last_ok_at ? (
                <p className="text-[11px] text-[var(--color-text-secondary)]">
                  {t('webhookOk', { when: fmtWhen(saved.last_ok_at, locale) })}
                </p>
              ) : null}
              {!showForm ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={test}
                    disabled={busy !== null}
                    className="text-xs font-medium px-3 py-1.5 rounded-full"
                    style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', opacity: busy ? 0.6 : 1 }}
                  >
                    {busy === 'test' ? t('webhookTesting') : t('webhookTest')}
                  </button>
                  <button
                    onClick={() => {
                      setReplacing(true);
                      setNote(null);
                    }}
                    disabled={busy !== null}
                    className="text-xs font-medium px-3 py-1.5 rounded-full"
                    style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                  >
                    {t('webhookReplace')}
                  </button>
                  <button
                    onClick={remove}
                    disabled={busy !== null}
                    className="text-xs font-medium px-3 py-1.5 rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-bear)]"
                  >
                    {t('webhookRemove')}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-snug">{t('webhookIntro')}</p>
          )}

          {showForm ? (
            <div className="mt-3 space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && url.trim() && !busy) connect();
                  }}
                  placeholder={t('webhookPlaceholder')}
                  aria-label={t('webhookTitle')}
                  className="flex-1 min-w-0 text-xs px-3 py-2 rounded-xl bg-transparent text-[var(--color-text-primary)]"
                  style={{ border: '1px solid var(--color-border)' }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={connect}
                    disabled={busy !== null || !url.trim()}
                    className="text-xs font-semibold px-4 py-2 rounded-full whitespace-nowrap"
                    style={{
                      backgroundColor: 'var(--color-info)',
                      color: 'var(--color-on-info, #ffffff)',
                      opacity: busy !== null || !url.trim() ? 0.6 : 1,
                    }}
                  >
                    {busy === 'connect' ? t('webhookConnecting') : t('webhookConnect')}
                  </button>
                  {replacing ? (
                    <button
                      onClick={() => {
                        setReplacing(false);
                        setUrl('');
                        setNote(null);
                      }}
                      className="text-xs font-medium px-3 py-2 rounded-full text-[var(--color-text-secondary)]"
                    >
                      {t('cancel')}
                    </button>
                  ) : null}
                </div>
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] leading-snug">{t('webhookHowDiscord')}</p>
              <p className="text-[11px] text-[var(--color-text-secondary)] leading-snug">{t('webhookHowSlack')}</p>
            </div>
          ) : null}

          {note ? (
            <p
              role="status"
              className="text-[11px] mt-2 leading-snug break-words"
              style={{ color: note.ok ? 'var(--color-bull)' : 'var(--color-warning)' }}
            >
              {note.text}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function DesktopToggle({ t }: { t: T }) {
  const permission = useSyncExternalStore(subscribeDesktopPref, desktopPermission, serverPermission);
  const on = useSyncExternalStore(subscribeDesktopPref, desktopEnabled, serverEnabled);

  const enable = async () => {
    if (permission === 'unsupported') return;
    let result: DesktopPermission = permission;
    if (permission === 'default') {
      try {
        result = (await Notification.requestPermission()) as DesktopPermission;
      } catch {
        result = desktopPermission();
      }
    }
    // Both paths notify subscribers, so a new permission shows even on refusal.
    if (result === 'granted') setDesktopEnabled(true);
    else notifyDesktopPref();
  };
  const disable = () => setDesktopEnabled(false);

  return (
    <section className="rounded-2xl p-5 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={card}>
      <div className="flex items-start gap-3">
        <Monitor className="w-4 h-4 mt-0.5 flex-shrink-0 text-[var(--color-text-secondary)]" />
        <div>
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">{t('desktopTitle')}</div>
          <div className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-snug">
            {permission === 'unsupported'
              ? t('desktopUnsupported')
              : permission === 'denied'
                ? t('desktopBlocked')
                : t('desktopBody')}
          </div>
        </div>
      </div>
      {permission !== 'unsupported' && permission !== 'denied' ? (
        on ? (
          <button
            onClick={disable}
            className="text-xs font-medium px-3 py-2 rounded-full self-start sm:self-auto"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            {t('desktopOn')} · {t('desktopTurnOff')}
          </button>
        ) : (
          <button
            onClick={enable}
            className="text-xs font-semibold px-3 py-2 rounded-full self-start sm:self-auto"
            style={{ backgroundColor: 'var(--color-info)', color: 'var(--color-on-info, #ffffff)' }}
          >
            {t('desktopEnable')}
          </button>
        )
      ) : null}
    </section>
  );
}

// ── How it works ────────────────────────────────────────────────────────────

function HowItWorks({ t }: { t: T }) {
  const [open, setOpen] = useState(false);
  const items = ['how_hit', 'how_break', 'how_hold', 'how_strength', 'how_noise', 'how_hours', 'how_webhook', 'how_api', 'how_disclaimer'];
  return (
    <section className="rounded-2xl mb-6" style={card}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <span className="text-sm font-semibold text-[var(--color-text-primary)]">{t('howTitle')}</span>
        <ChevronDown
          className="w-4 h-4 text-[var(--color-text-secondary)] transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>
      {open ? (
        <ul className="px-5 pb-5 space-y-2">
          {items.map((key) => (
            <li key={key} className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              {t(key)}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
