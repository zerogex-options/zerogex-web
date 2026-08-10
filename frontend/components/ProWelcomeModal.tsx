'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, KeyRound, Sparkles, X } from 'lucide-react';
import { Theme } from '@/core/types';

interface ProWelcomeModalProps {
  theme: Theme;
  // Hide the modal for this browser session (sets sessionStorage + local state)
  // and refresh the shared auth session so the newly-stamped seen flag sticks.
  onClose: () => void;
}

export default function ProWelcomeModal({ theme, onClose }: ProWelcomeModalProps) {
  const isDark = theme === 'dark';
  const [submitting, setSubmitting] = useState(false);
  // Guards every exit path so a double-click (or Escape + button) can't fire
  // onClose twice or race two persist requests.
  const closingRef = useRef(false);
  const ctaRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ctaRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Persist "seen" server-side so the welcome never returns on another device
  // or a later session. Best-effort: the caller still hides it locally even if
  // this throws (the sessionStorage backstop covers the current session, and
  // the server flag simply re-shows on a future login).
  const persistSeen = useCallback(async () => {
    const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'include' });
    const csrfPayload = (await csrfResponse.json()) as { csrfToken?: string };
    const token = csrfPayload.csrfToken;
    if (!token) return;
    await fetch('/api/auth/pro-welcome-seen', {
      method: 'POST',
      credentials: 'include',
      headers: { 'x-csrf-token': token },
    });
  }, []);

  // Close paths that stay on the current page (X button, "Maybe later",
  // Escape): persist, then hand back to the parent to hide + refresh.
  const dismiss = useCallback(async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setSubmitting(true);
    try {
      await persistSeen();
    } catch {
      // Non-blocking — see persistSeen note.
    } finally {
      onClose();
    }
  }, [onClose, persistSeen]);

  // CTA path (navigates to /account): don't block the click on the network.
  // Mark seen locally right away and fire the persist in the background so the
  // Link navigation proceeds immediately.
  const handleCta = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    void persistSeen().catch(() => {});
    onClose();
  }, [onClose, persistSeen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismiss]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-welcome-modal-title"
      aria-describedby="pro-welcome-modal-body"
      style={{
        position: 'fixed',
        inset: 0,
        // Below the disclaimer (1000) and founding lock-in (999) modals. Those
        // are gated to clear before this one shows, so they never truly stack;
        // the lower z-index is just belt-and-suspenders during a state flip.
        zIndex: 998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 540,
          // Cap to the viewport and scroll internally so the CTA stays reachable
          // on short/landscape phones instead of clipping off-screen.
          maxHeight: 'calc(100dvh - 32px)',
          overflowY: 'auto',
          position: 'relative',
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: 12,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
          padding: '28px 28px 24px',
        }}
      >
        <button
          type="button"
          onClick={() => void dismiss()}
          disabled={submitting}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: 6,
            cursor: submitting ? 'not-allowed' : 'pointer',
            padding: 0,
          }}
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div
          id="pro-welcome-modal-title"
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--color-brand-primary)',
            marginBottom: 10,
          }}
        >
          Welcome to ZeroGEX Pro
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 14px 0', lineHeight: 1.3 }}>
          You&apos;re in — your Pro trial is live 🎉
        </h2>

        <div
          id="pro-welcome-modal-body"
          style={{
            fontSize: 14,
            lineHeight: 1.65,
            color: 'var(--text-secondary)',
            marginBottom: 18,
          }}
        >
          <p style={{ margin: '0 0 10px 0' }}>
            Thanks for subscribing. You now have full access to everything Pro unlocks &mdash;
            advanced signals, real-time dealer positioning, GEX heatmaps, and backtesting.
          </p>
          <p style={{ margin: 0 }}>
            Jump into the{' '}
            <Link href="/dashboard" style={{ color: 'var(--color-brand-primary)', fontWeight: 600 }}>
              dashboard
            </Link>{' '}
            whenever you&apos;re ready. One new thing worth knowing about first:
          </p>
        </div>

        {/* Feature-announcement highlight card. */}
        <div
          style={{
            border: '1px solid var(--border-default)',
            borderRadius: 12,
            padding: '16px 18px',
            marginBottom: 18,
            background: isDark
              ? 'rgba(255, 255, 255, 0.03)'
              : 'rgba(0, 0, 0, 0.02)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-brand-primary)',
              }}
            >
              <Sparkles size={18} aria-hidden="true" />
            </span>
            <strong style={{ fontSize: 15, color: 'var(--text-primary)' }}>
              New: Self-service API key generation
            </strong>
          </div>
          <p style={{ margin: '0 0 12px 0', fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            Call the ZeroGEX data API directly from your own scripts, spreadsheets, and integrations
            &mdash; no waiting on support. If you need a key:
          </p>
          <ol
            style={{
              margin: '0 0 4px 0',
              paddingLeft: 20,
              fontSize: 13.5,
              lineHeight: 1.7,
              color: 'var(--text-secondary)',
            }}
          >
            <li>
              Open{' '}
              <Link
                href="/account#api-access"
                onClick={handleCta}
                style={{ color: 'var(--color-brand-primary)', fontWeight: 600 }}
              >
                Account → API Access
              </Link>
              .
            </li>
            <li>
              Click <strong style={{ color: 'var(--text-primary)' }}>Generate API Key</strong> and copy
              the secret &mdash; it&apos;s shown only once.
            </li>
            <li>
              Send it on your requests as{' '}
              <code style={{ fontSize: 12.5 }}>Authorization: Bearer &lt;key&gt;</code>.
            </li>
          </ol>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void dismiss()}
            disabled={submitting}
            style={{
              flex: '0 0 auto',
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: 'var(--text-secondary)',
              backgroundColor: 'transparent',
              border: '1px solid var(--border-default)',
              borderRadius: 8,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Saving…' : 'Maybe later'}
          </button>
          <Link
            ref={ctaRef}
            href="/account#api-access"
            onClick={handleCta}
            style={{
              flex: '1 1 auto',
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: '#ffffff',
              backgroundColor: 'var(--color-brand-primary)',
              border: 'none',
              borderRadius: 8,
              textAlign: 'center',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <KeyRound size={16} aria-hidden="true" />
            Generate an API key
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <p
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            textAlign: 'center',
            marginTop: 14,
            marginBottom: 0,
          }}
        >
          You can generate or regenerate a key anytime from your Account page.
        </p>
      </div>
    </div>
  );
}
