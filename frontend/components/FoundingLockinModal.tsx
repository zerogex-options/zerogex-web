'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { Theme } from '@/core/types';
import { colors } from '@/core/colors';

interface FoundingLockinModalProps {
  theme: Theme;
  onClose: () => void;
  onDismissedPermanently: () => void;
}

export default function FoundingLockinModal({
  theme,
  onClose,
  onDismissedPermanently,
}: FoundingLockinModalProps) {
  const isDark = theme === 'dark';
  const [doNotShow, setDoNotShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    buttonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const persistDismiss = useCallback(async () => {
    const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'include' });
    const csrfPayload = (await csrfResponse.json()) as { csrfToken?: string };
    const token = csrfPayload.csrfToken;
    if (!token) throw new Error('Could not initialize secure request.');

    const response = await fetch('/api/auth/founding-lockin-dismiss', {
      method: 'POST',
      credentials: 'include',
      headers: { 'x-csrf-token': token },
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error ?? 'Failed to save preference.');
    }
  }, []);

  const handleClose = useCallback(async () => {
    setError(null);
    if (!doNotShow) {
      onClose();
      return;
    }
    setSubmitting(true);
    try {
      await persistDismiss();
      onDismissedPermanently();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [doNotShow, onClose, onDismissedPermanently, persistDismiss]);

  const handleCta = useCallback(async () => {
    if (doNotShow) {
      try {
        await persistDismiss();
        onDismissedPermanently();
      } catch {
        // Non-blocking: even if persistence fails, still let the navigation
        // proceed. The session flag will simply re-show next login.
        onClose();
      }
      return;
    }
    onClose();
  }, [doNotShow, onClose, onDismissedPermanently, persistDismiss]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="founding-lockin-modal-title"
      aria-describedby="founding-lockin-modal-body"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
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
          maxWidth: 520,
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
          onClick={handleClose}
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
          id="founding-lockin-modal-title"
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: colors.primary,
            marginBottom: 10,
          }}
        >
          Founding Member
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 16px 0', lineHeight: 1.3 }}>
          Lock in your Founding Member rate before July 1
        </h2>

        <div
          id="founding-lockin-modal-body"
          style={{
            fontSize: 14,
            lineHeight: 1.65,
            color: 'var(--text-secondary)',
            marginBottom: 20,
          }}
        >
          <p style={{ margin: '0 0 12px 0' }}>
            You&apos;re on the Founding Member list, which means you can subscribe at the
            founding rate &mdash; locked in for life as long as your subscription stays active.
          </p>
          <p style={{ margin: 0 }}>
            This offer expires <strong>July 1</strong>. Activate your subscription before then
            to keep the founding price.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              fontSize: 13,
              color: 'var(--color-bear)',
              backgroundColor: 'var(--color-bear-soft)',
              border: '1px solid var(--color-bear)',
              borderRadius: 8,
              padding: '10px 12px',
              marginBottom: 14,
            }}
          >
            {error}
          </div>
        )}

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            color: 'var(--text-secondary)',
            marginBottom: 16,
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={doNotShow}
            onChange={(e) => setDoNotShow(e.target.checked)}
            disabled={submitting}
            style={{ cursor: submitting ? 'not-allowed' : 'pointer' }}
          />
          Please do not show this again
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={handleClose}
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
            {submitting ? 'Saving…' : 'Close'}
          </button>
          <Link
            ref={buttonRef}
            href="/founding"
            onClick={handleCta}
            style={{
              flex: '1 1 auto',
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: '#ffffff',
              backgroundColor: colors.primary,
              border: 'none',
              borderRadius: 8,
              textAlign: 'center',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Lock in my rate
          </Link>
        </div>

        <p
          style={{
            fontSize: 11,
            color: isDark ? 'var(--text-muted)' : 'var(--text-muted)',
            textAlign: 'center',
            marginTop: 14,
            marginBottom: 0,
          }}
        >
          Founding rates are honored for the life of your subscription.
        </p>
      </div>
    </div>
  );
}
