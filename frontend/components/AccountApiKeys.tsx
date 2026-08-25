'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Copy, KeyRound, Rocket, ShieldCheck, Trash2 } from 'lucide-react';
import { MAX_ACTIVE_API_KEYS } from '@/core/apiKeyLimits';
import { MAX_KEY_LABEL_LENGTH, formatLastUsed, sanitizeKeyLabel } from '@/core/apiKeyNaming';

// How long the freshly-minted secret stays on screen. After this it is wiped
// from React state and never shown again (a refresh or navigation also wipes
// it — it is never persisted anywhere client-side).
const REVEAL_SECONDS = 180;

// How often the "last used" phrasing is recomputed. A key in active use should
// visibly tick over from "2 minutes ago" without needing a reload.
const CLOCK_TICK_MS = 60_000;

type KeyInfo = {
  id: number;
  name: string;
  prefix: string;
  createdAt: string | null;
  lastUsedAt: string | null;
};

type StatusPayload = {
  eligible: boolean;
  configured: boolean;
  serviceError: boolean;
  keys: KeyInfo[];
  maxKeys: number;
};

type RevealedKey = {
  apiKey: string;
  name: string;
  prefix: string;
  createdAt: string | null;
};

const C = {
  card: 'var(--color-surface)',
  light: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
  amber: 'var(--color-brand-primary)',
  border: 'var(--color-border)',
};

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    background: `linear-gradient(135deg, ${C.amber} 0%, var(--heat-mid) 100%)`,
    border: 'none',
    borderRadius: 10,
    padding: '10px 18px',
    color: 'var(--text-inverse)',
    fontWeight: 800,
    fontSize: 14,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  };
}

function secondaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    background: 'transparent',
    border: `1px solid ${C.border}`,
    color: C.light,
    borderRadius: 10,
    padding: '10px 16px',
    fontWeight: 700,
    fontSize: 13,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  };
}

export default function AccountApiKeys() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [revealed, setRevealed] = useState<RevealedKey | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const [confirmingRevokeId, setConfirmingRevokeId] = useState<number | null>(null);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  // Safe to seed from the clock during render: the key cards that read it only
  // ever appear after the client-side fetch below resolves, so the SSR pass and
  // the hydration pass both render "Loading…" and can't disagree.
  const [nowMs, setNowMs] = useState(() => Date.now());

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/account/api-keys', { credentials: 'include' });
      if (!res.ok) {
        setStatus(null);
        return;
      }
      const payload = (await res.json()) as Partial<StatusPayload>;
      setStatus({
        eligible: !!payload.eligible,
        configured: !!payload.configured,
        serviceError: !!payload.serviceError,
        keys: payload.keys ?? [],
        maxKeys: payload.maxKeys ?? MAX_ACTIVE_API_KEYS,
      });
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Keep the "last used" phrasing current without a reload.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Countdown for the one-time reveal. When it hits zero we wipe the secret
  // from state so it can never be read again without generating a new one.
  useEffect(() => {
    if (!revealed) return;
    if (secondsLeft <= 0) {
      setRevealed(null);
      return;
    }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [revealed, secondsLeft]);

  // Both mutating calls need a fresh CSRF token; null means we couldn't get
  // one and the caller has already been told why.
  const getCsrfToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/csrf', { credentials: 'include' });
      const payload = (await res.json()) as { csrfToken?: string };
      if (payload.csrfToken) return payload.csrfToken;
    } catch {
      /* fall through to the shared message */
    }
    setError('Could not obtain a security token. Refresh and try again.');
    return null;
  }, []);

  const generate = useCallback(async () => {
    setBusy(true);
    setError(null);
    setConfirmingRevokeId(null);
    try {
      const csrfToken = await getCsrfToken();
      if (!csrfToken) return;
      const res = await fetch('/api/account/api-keys', {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-csrf-token': csrfToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: sanitizeKeyLabel(label) }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        apiKey?: string;
        name?: string;
        prefix?: string;
        createdAt?: string | null;
        error?: string;
      };
      if (!res.ok || !payload.ok || !payload.apiKey) {
        setError(payload.error ?? 'Could not generate your API key. Please try again.');
        // The cap and the tier gate are both server-side truths; re-read them
        // so the form reflects what the server just told us.
        void refreshStatus();
        return;
      }
      const rawKey = payload.apiKey;
      // Show the secret once and start the countdown. The name shown is the
      // server's, not the label typed: it appends "-1", "-2", … when a label
      // has been used before, and the user needs to recognise the key by the
      // name it actually has.
      setRevealed({
        apiKey: rawKey,
        name: payload.name ?? '',
        prefix: payload.prefix ?? rawKey.slice(0, 8),
        createdAt: payload.createdAt ?? null,
      });
      setSecondsLeft(REVEAL_SECONDS);
      setCopied(false);
      setLabel('');
      // Reconcile with the server in the background.
      void refreshStatus();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [getCsrfToken, label, refreshStatus]);

  const revoke = useCallback(
    async (id: number) => {
      setRevokingId(id);
      setError(null);
      try {
        const csrfToken = await getCsrfToken();
        if (!csrfToken) return;
        const res = await fetch(`/api/account/api-keys?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'x-csrf-token': csrfToken },
        });
        const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !payload.ok) {
          setError(payload.error ?? 'Could not revoke that key. Please try again.');
        }
        setConfirmingRevokeId(null);
        // Refresh either way: on success to drop the row, and on a 404 because
        // the key is already gone and the list is what's stale.
        await refreshStatus();
      } catch {
        setError('Something went wrong. Please try again.');
      } finally {
        setRevokingId(null);
      }
    },
    [getCsrfToken, refreshStatus],
  );

  const keys = status?.keys ?? [];
  const maxKeys = status?.maxKeys ?? MAX_ACTIVE_API_KEYS;
  const atCap = keys.length >= maxKeys;

  return (
    // id="api-access" is the deep-link target for the Pro welcome modal's CTA
    // (/account#api-access). scroll-margin clears the sticky app nav so the
    // section header isn't hidden under it after the hash jump.
    <section
      id="api-access"
      style={{ marginTop: 24, scrollMarginTop: 'calc(var(--zgx-nav-height, 0px) + 16px)' }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 800,
          color: C.light,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', color: C.amber }}>
          <KeyRound size={18} />
        </span>
        API Access
      </h2>
      <p style={{ margin: '6px 0 14px', color: C.muted, fontSize: 14 }}>
        Generate a personal API key to call the ZeroGEX data API directly from your own scripts,
        spreadsheets, and integrations. Send it as{' '}
        <code style={{ fontSize: 12.5 }}>Authorization: Bearer &lt;key&gt;</code>. You can hold up to{' '}
        {maxKeys} keys at once — name one per machine, and revoke a single key without disturbing the
        others.
      </p>

      {loading ? (
        <p style={{ color: C.muted, fontSize: 14 }}>Loading…</p>
      ) : !status?.eligible ? (
        <ProUpsell />
      ) : !status.configured ? (
        <SoftNote>API key generation is temporarily unavailable. Please check back soon.</SoftNote>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {revealed && (
            <RevealBox
              revealed={revealed}
              secondsLeft={secondsLeft}
              copied={copied}
              onCopy={async () => {
                try {
                  await navigator.clipboard.writeText(revealed.apiKey);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  setError('Could not copy to clipboard. Select the key and copy it manually.');
                }
              }}
            />
          )}

          {keys.length > 0 ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 12.5, color: C.muted, fontWeight: 700 }}>
                {keys.length} of {maxKeys} keys in use
              </div>
              {keys.map((info) => (
                <KeyCard
                  key={info.id}
                  info={info}
                  nowMs={nowMs}
                  confirming={confirmingRevokeId === info.id}
                  revoking={revokingId === info.id}
                  busy={busy || revokingId !== null}
                  onAskRevoke={() => {
                    setError(null);
                    setConfirmingRevokeId(info.id);
                  }}
                  onCancelRevoke={() => setConfirmingRevokeId(null)}
                  onConfirmRevoke={() => revoke(info.id)}
                />
              ))}
            </div>
          ) : (
            !status.serviceError && (
              <SoftNote>You don&apos;t have an API key yet. Generate one to get started.</SoftNote>
            )
          )}

          {status.serviceError && (
            <p style={{ margin: 0, color: 'var(--color-bear)', fontSize: 13 }}>
              We couldn&apos;t load your current keys. You can still try generating one below.
            </p>
          )}

          {error && (
            <p style={{ margin: 0, color: 'var(--color-bear)', fontSize: 13, fontWeight: 600 }}>
              {error}
            </p>
          )}

          {/* While the one-time secret is on screen, hide the form so the user
              focuses on saving the key they can't see again. */}
          {!revealed &&
            (atCap ? (
              <SoftNote>
                You&apos;re using all {maxKeys} of your API keys. Revoke one you no longer need to
                make room for another.
              </SoftNote>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                <label
                  htmlFor="api-key-label"
                  style={{ fontSize: 13, fontWeight: 700, color: C.light }}
                >
                  Name this key
                </label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    id="api-key-label"
                    type="text"
                    value={label}
                    maxLength={MAX_KEY_LABEL_LENGTH}
                    onChange={(e) => setLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !busy) generate();
                    }}
                    placeholder="desktop, laptop, NinjaTrader…"
                    disabled={busy}
                    style={{
                      flex: '1 1 220px',
                      minWidth: 0,
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1px solid ${C.border}`,
                      background: 'var(--color-surface)',
                      color: C.light,
                      fontSize: 14,
                    }}
                  />
                  <button
                    type="button"
                    onClick={generate}
                    disabled={busy}
                    style={primaryButtonStyle(busy)}
                  >
                    <KeyRound size={16} />
                    {busy ? 'Working…' : 'Generate API Key'}
                  </button>
                </div>
                <p style={{ margin: 0, color: C.muted, fontSize: 12.5 }}>
                  Optional — a name makes it obvious which machine a key belongs to when you come
                  back to revoke one. Generating a key never affects your existing keys.
                </p>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}

function RevealBox({
  revealed,
  secondsLeft,
  copied,
  onCopy,
}: {
  revealed: RevealedKey;
  secondsLeft: number;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div
      role="status"
      style={{
        borderRadius: 14,
        padding: '16px 18px',
        border: `1px solid ${C.amber}66`,
        background: `linear-gradient(135deg, ${C.amber}1a 0%, ${C.amber}08 100%)`,
        display: 'grid',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <ShieldCheck size={16} color={C.amber} />
        <strong style={{ fontSize: 14, color: C.light }}>
          Save this key now — you won&apos;t be able to see it again.
        </strong>
      </div>
      <p style={{ margin: 0, color: C.muted, fontSize: 13, lineHeight: 1.5 }}>
        This is the only time your key <strong style={{ color: C.light }}>{revealed.name}</strong> is
        shown. Store it somewhere safe (a password manager or secret store). It hides automatically
        in <strong style={{ color: C.amber }}>{formatCountdown(secondsLeft)}</strong>, and refreshing
        or leaving this page removes it for good.
      </p>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          background: 'var(--color-surface)',
        }}
      >
        <code
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            color: C.light,
            wordBreak: 'break-all',
            fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
          }}
        >
          {revealed.apiKey}
        </code>
        <button
          type="button"
          onClick={onCopy}
          style={{ ...secondaryButtonStyle(false), whiteSpace: 'nowrap' }}
        >
          <Copy size={14} /> {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

function KeyCard({
  info,
  nowMs,
  confirming,
  revoking,
  busy,
  onAskRevoke,
  onCancelRevoke,
  onConfirmRevoke,
}: {
  info: KeyInfo;
  nowMs: number;
  confirming: boolean;
  revoking: boolean;
  busy: boolean;
  onAskRevoke: () => void;
  onCancelRevoke: () => void;
  onConfirmRevoke: () => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 10,
        padding: '14px 16px',
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        background: 'var(--bg-active)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.light }}>{info.name}</div>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>
            <code style={{ fontSize: 12.5 }}>{info.prefix}…</code> · created{' '}
            {formatDate(info.createdAt)} ·{' '}
            {/* The liveness signal: a key that is working says so, which is
                what someone wondering "is this one still good?" needs. */}
            <span style={{ color: info.lastUsedAt ? 'var(--color-bull)' : C.muted }}>
              {formatLastUsed(info.lastUsedAt, nowMs)}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-bull)',
              border: '1px solid var(--color-bull)',
              background: 'var(--color-bull-soft)',
              borderRadius: 999,
              padding: '3px 10px',
            }}
          >
            Active
          </span>
          {!confirming && (
            <button
              type="button"
              onClick={onAskRevoke}
              disabled={busy}
              aria-label={`Revoke API key ${info.name}`}
              style={{ ...secondaryButtonStyle(busy), padding: '8px 12px' }}
            >
              <Trash2 size={14} /> Revoke
            </button>
          )}
        </div>
      </div>

      {confirming && (
        <div style={{ display: 'grid', gap: 10, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
          <p style={{ margin: 0, color: C.light, fontSize: 13.5, fontWeight: 600 }}>
            Revoking <strong>{info.name}</strong> stops it working immediately. Anything still using
            this key will start failing; your other keys are unaffected. Continue?
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onConfirmRevoke}
              disabled={revoking}
              style={primaryButtonStyle(revoking)}
            >
              {revoking ? 'Revoking…' : 'Yes, revoke it'}
            </button>
            <button
              type="button"
              onClick={onCancelRevoke}
              disabled={revoking}
              style={secondaryButtonStyle(revoking)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SoftNote({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        background: 'var(--bg-active)',
        color: C.muted,
        fontSize: 13.5,
      }}
    >
      {children}
    </div>
  );
}

function ProUpsell() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        flexWrap: 'wrap',
        padding: '16px 18px',
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        background: 'var(--bg-active)',
      }}
    >
      <p style={{ margin: 0, color: C.muted, fontSize: 14 }}>
        Personal API keys are a <strong style={{ color: C.light }}>Pro</strong> feature. Upgrade to
        call the ZeroGEX API directly from your own tools.
      </p>
      <Link
        href="/pricing"
        style={{
          ...primaryButtonStyle(false),
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        <Rocket size={14} /> Upgrade to Pro
      </Link>
    </div>
  );
}
