'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Theme } from '@/core/types';
import { colors } from '@/core/colors';

interface DisclaimerModalProps {
  theme: Theme;
  onAcknowledged: () => void;
}

export default function DisclaimerModal({ theme, onAcknowledged }: DisclaimerModalProps) {
  const isDark = theme === 'dark';
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    buttonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const handleAcknowledge = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'include' });
      const csrfPayload = (await csrfResponse.json()) as { csrfToken?: string };
      const token = csrfPayload.csrfToken;
      if (!token) {
        setError('Could not initialize secure request. Please refresh and try again.');
        return;
      }

      const response = await fetch('/api/auth/disclaimer-acknowledge', {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-csrf-token': token },
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? 'Failed to record acknowledgment. Please try again.');
        return;
      }

      onAcknowledged();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [onAcknowledged]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-modal-title"
      aria-describedby="disclaimer-modal-body"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
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
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: 12,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
          padding: '28px 28px 24px',
        }}
      >
        <div
          id="disclaimer-modal-title"
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: colors.primary,
            marginBottom: 10,
          }}
        >
          Important Disclaimer
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 16px 0', lineHeight: 1.3 }}>
          Please acknowledge before continuing
        </h2>

        <div
          id="disclaimer-modal-body"
          style={{
            fontStyle: 'italic',
            fontSize: 14,
            lineHeight: 1.65,
            color: 'var(--text-secondary)',
            marginBottom: 20,
          }}
        >
          <p style={{ margin: '0 0 12px 0' }}>
            None of the content on this platform constitutes financial, investment, trading, or
            tax advice. All information, data, signals, and analysis are provided strictly for
            educational and entertainment purposes only.
          </p>
          <p style={{ margin: '0 0 12px 0' }}>
            Trading and investing in securities, options, and other financial instruments
            involves substantial risk of loss and is not suitable for every investor. Past
            performance is not indicative of future results.
          </p>
          <p style={{ margin: 0 }}>
            You are solely responsible for your own trading decisions. Consult a licensed
            financial advisor before making any investment decisions.
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

        <button
          ref={buttonRef}
          type="button"
          onClick={handleAcknowledge}
          disabled={submitting}
          style={{
            width: '100%',
            padding: '12px 16px',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '0.02em',
            color: '#ffffff',
            backgroundColor: submitting ? `${colors.primary}99` : colors.primary,
            border: 'none',
            borderRadius: 8,
            cursor: submitting ? 'not-allowed' : 'pointer',
            transition: 'background-color 150ms ease, transform 150ms ease',
          }}
          onMouseEnter={(e) => {
            if (!submitting) e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          {submitting ? 'Recording…' : 'I Understand'}
        </button>

        <p
          style={{
            fontSize: 11,
            color: isDark ? 'var(--text-muted)' : 'var(--text-muted)',
            textAlign: 'center',
            marginTop: 14,
            marginBottom: 0,
          }}
        >
          By clicking &quot;I Understand&quot;, you acknowledge that you have read and accept the
          terms of this disclaimer.
        </p>
      </div>
    </div>
  );
}
