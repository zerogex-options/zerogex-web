'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Copy, KeyRound, Rocket, ShieldCheck } from 'lucide-react';

// How long the freshly-minted secret stays on screen. After this it is wiped
// from React state and never shown again (a refresh or navigation also wipes
// it — it is never persisted anywhere client-side).
const REVEAL_SECONDS = 180;

type KeyInfo = {
  name: string;
  prefix: string;
  createdAt: string | null;
  lastUsedAt: string | null;
};

type StatusPayload = {
  eligible: boolean;
  configured: boolean;
  serviceError: boolean;
  hasActiveKey: boolean;
  key: KeyInfo | null;
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
  const [confirmingRegen, setConfirmingRegen] = useState(false);
  const [revealed, setRevealed] = useState<RevealedKey | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [copied, setCopied] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/account/api-keys', { credentials: 'include' });
      if (!res.ok) {
        setStatus(null);
        return;
      }
      setStatus((await res.json()) as StatusPayload);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

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

  const generate = useCallback(async () => {
    setBusy(true);
    setError(null);
    setConfirmingRegen(false);
    try {
      const csrfRes = await fetch('/api/auth/csrf', { credentials: 'include' });
      const csrf = (await csrfRes.json()) as { csrfToken?: string };
      if (!csrf.csrfToken) {
        setError('Could not obtain a security token. Refresh and try again.');
        return;
      }
      const res = await fetch('/api/account/api-keys', {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-csrf-token': csrf.csrfToken, 'Content-Type': 'application/json' },
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
        return;
      }
      const rawKey = payload.apiKey;
      const name = payload.name ?? '';
      const prefix = payload.prefix ?? rawKey.slice(0, 8);
      const createdAt = payload.createdAt ?? null;
      // Show the secret once, start the countdown, and optimistically reflect
      // that an active key now exists (so the button becomes "Regenerate").
      setRevealed({ apiKey: rawKey, name, prefix, createdAt });
      setSecondsLeft(REVEAL_SECONDS);
      setCopied(false);
      setStatus((prev) =>
        prev
          ? { ...prev, hasActiveKey: true, key: { name, prefix, createdAt, lastUsedAt: null } }
          : prev,
      );
      // Reconcile with the server in the background.
      void refreshStatus();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [refreshStatus]);

  const copyKey = useCallback(async () => {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy to clipboard. Select the key and copy it manually.');
    }
  }, [revealed]);

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
        <code style={{ fontSize: 12.5 }}>Authorization: Bearer &lt;key&gt;</code>.
      </p>

      {loading ? (
        <p style={{ color: C.muted, fontSize: 14 }}>Loading…</p>
      ) : !status?.eligible ? (
        <ProUpsell />
      ) : !status.configured ? (
        <SoftNote>API key generation is temporarily unavailable. Please check back soon.</SoftNote>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {revealed ? (
            <RevealBox
              revealed={revealed}
              secondsLeft={secondsLeft}
              copied={copied}
              onCopy={copyKey}
            />
          ) : status.hasActiveKey && status.key ? (
            <ActiveKeyCard info={status.key} />
          ) : (
            <SoftNote>You don&apos;t have an API key yet. Generate one to get started.</SoftNote>
          )}

          {status.serviceError && !revealed && (
            <p style={{ margin: 0, color: 'var(--color-bear)', fontSize: 13 }}>
              We couldn&apos;t load your current key status. You can still try generating one below.
            </p>
          )}

          {error && (
            <p style={{ margin: 0, color: 'var(--color-bear)', fontSize: 13, fontWeight: 600 }}>
              {error}
            </p>
          )}

          {/* While the one-time secret is on screen, hide the action button so
              the user focuses on saving it rather than immediately regenerating
              (which would deactivate the key they haven't stored yet). */}
          {!revealed &&
            (confirmingRegen ? (
              <div
                style={{
                  display: 'grid',
                  gap: 10,
                  padding: 14,
                  borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  background: 'var(--bg-active)',
                }}
              >
                <p style={{ margin: 0, color: C.light, fontSize: 13.5, fontWeight: 600 }}>
                  Regenerating immediately deactivates your current key. Any integration still using
                  it will stop working. Continue?
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={generate}
                    disabled={busy}
                    style={primaryButtonStyle(busy)}
                  >
                    {busy ? 'Regenerating…' : 'Yes, regenerate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingRegen(false)}
                    disabled={busy}
                    style={secondaryButtonStyle(busy)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    if (status.hasActiveKey) {
                      setError(null);
                      setConfirmingRegen(true);
                    } else {
                      generate();
                    }
                  }}
                  disabled={busy}
                  style={primaryButtonStyle(busy)}
                >
                  <KeyRound size={16} />
                  {busy
                    ? 'Working…'
                    : status.hasActiveKey
                      ? 'Regenerate API Key'
                      : 'Generate API Key'}
                </button>
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

function ActiveKeyCard({ info }: { info: KeyInfo }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        padding: '14px 16px',
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        background: 'var(--bg-active)',
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.light }}>{info.name}</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>
          <code style={{ fontSize: 12.5 }}>{info.prefix}…</code> · created {formatDate(info.createdAt)}
          {info.lastUsedAt ? ` · last used ${formatDate(info.lastUsedAt)}` : ' · not used yet'}
        </div>
      </div>
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
