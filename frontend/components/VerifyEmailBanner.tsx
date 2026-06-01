'use client';

import { useCallback, useState } from 'react';

type Status = 'idle' | 'busy' | 'sent' | 'error';

// Yellow "please verify your email" banner shown above the subscribe cards
// on /pricing and /founding when the session is authed but email is not yet
// verified. The Resend button hits POST /api/auth/verify-email/start, which
// is rate-limited server-side to 3 sends per hour per user.
//
// Refresh is intentionally not called after a successful resend — the user
// hasn't verified yet, they've just received another link. The banner only
// goes away once the email_verified_at column flips to non-null and the
// next session refresh picks it up (handled by callers via ?verified=1).
export default function VerifyEmailBanner({ email }: { email: string }) {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const onResend = useCallback(async () => {
    if (status === 'busy') return;
    setStatus('busy');
    setMessage(null);
    try {
      const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'include' });
      const csrf = (await csrfResponse.json()) as { csrfToken?: string };
      if (!csrf.csrfToken) {
        throw new Error('Could not obtain CSRF token. Refresh and try again.');
      }

      const response = await fetch('/api/auth/verify-email/start', {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-csrf-token': csrf.csrfToken, 'content-type': 'application/json' },
      });
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? 'Could not send verification email.');
      }
      setStatus('sent');
      setMessage('Sent — check your inbox.');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }, [status]);

  const busy = status === 'busy';
  const sent = status === 'sent';

  return (
    <div
      role="status"
      style={{
        maxWidth: 720,
        margin: '0 auto 24px',
        padding: '12px 16px',
        borderRadius: 12,
        border: '1px solid var(--color-warning)',
        background: 'var(--color-warning-soft)',
        color: 'var(--color-text-primary)',
        fontSize: 14,
        lineHeight: 1.55,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ flex: 1, minWidth: 220 }}>
        Please verify your email to subscribe. We sent a link to <strong>{email}</strong>. Didn&rsquo;t get it?
      </span>
      <button
        type="button"
        onClick={onResend}
        disabled={busy || sent}
        style={{
          background: 'var(--color-warning)',
          color: 'var(--text-inverse)',
          border: 'none',
          borderRadius: 8,
          padding: '8px 14px',
          fontSize: 13,
          fontWeight: 700,
          cursor: busy ? 'wait' : sent ? 'default' : 'pointer',
          opacity: busy || sent ? 0.6 : 1,
        }}
      >
        {busy ? 'Sending…' : sent ? 'Sent' : 'Resend'}
      </button>
      {message && (
        <span
          style={{
            width: '100%',
            fontSize: 13,
            color: status === 'error' ? 'var(--color-bear)' : 'var(--color-text-secondary)',
          }}
        >
          {message}
        </span>
      )}
    </div>
  );
}
