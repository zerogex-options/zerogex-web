'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getCsrfToken } from '@/core/csrfClient';
import { useLanguage } from '@/core/LanguageContext';
import { TERMS_VERSION, TERMS_EFFECTIVE_DATE_LABEL } from '@/core/legalTerms';

interface TermsAcceptanceModalProps {
  onAccepted: () => void;
}

/**
 * The acceptance gate for members whose account carries no current record of
 * agreeing to the Terms of Service and Privacy Policy.
 *
 * It asks rather than assumes. Every account created before the signup
 * checkbox shipped, and every account minted through the Google/Apple
 * callback, has NULL acceptance columns, and the only way to turn that into a
 * record worth holding is for the member to actually tick the box — a
 * timestamp written on their behalf would assert an act that never happened.
 *
 * Deliberately shaped like the /register checkbox rather than the disclaimer's
 * single "I Understand" button: the same affirmative act, against the same
 * links, recording the same version, so the row this produces is the same kind
 * of evidence a post-cutover signup produces.
 */
export default function TermsAcceptanceModal({ onAccepted }: TermsAcceptanceModalProps) {
  const { t } = useLanguage();
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkboxRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    checkboxRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const handleAccept = useCallback(async () => {
    if (!accepted) {
      setError(t('register.termsRequired'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const token = await getCsrfToken();
      if (!token) {
        setError(t('termsGate.csrfError'));
        return;
      }

      const response = await fetch('/api/auth/terms-accept', {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-csrf-token': token, 'Content-Type': 'application/json' },
        // The version this modal actually rendered its links against, so a tab
        // left open across a revision is rejected by the route rather than
        // recorded as accepting text the member never saw.
        body: JSON.stringify({ acceptedTermsVersion: TERMS_VERSION }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? t('termsGate.error'));
        return;
      }

      onAccepted();
    } catch {
      setError(t('termsGate.networkError'));
    } finally {
      setSubmitting(false);
    }
  }, [accepted, onAccepted, t]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-gate-title"
      aria-describedby="terms-gate-body"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1001,
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
          // Same viewport cap as the disclaimer gate: this blocks the whole
          // app, so the accept control has to stay reachable on a short or
          // landscape phone where the copy would otherwise clip it off-screen.
          maxHeight: 'calc(100dvh - 32px)',
          overflowY: 'auto',
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: 12,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
          padding: '28px 28px 24px',
        }}
      >
        <div
          id="terms-gate-title"
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--color-brand-primary)',
            marginBottom: 10,
          }}
        >
          {t('termsGate.eyebrow')}
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 16px 0', lineHeight: 1.3 }}>
          {t('termsGate.title')}
        </h2>

        <p
          id="terms-gate-body"
          style={{
            fontSize: 14,
            lineHeight: 1.65,
            color: 'var(--text-secondary)',
            margin: '0 0 18px 0',
          }}
        >
          {t('termsGate.body')}
        </p>

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            fontSize: 14,
            lineHeight: 1.6,
            marginBottom: 18,
            cursor: 'pointer',
          }}
        >
          <input
            ref={checkboxRef}
            type="checkbox"
            checked={accepted}
            onChange={(event) => {
              setAccepted(event.target.checked);
              if (event.target.checked) setError(null);
            }}
            style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }}
          />
          <span style={{ color: 'var(--text-secondary)' }}>
            {t('register.termsIntro')}{' '}
            <Link
              href="/terms"
              target="_blank"
              style={{ color: 'var(--color-brand-primary)', textDecoration: 'underline' }}
            >
              {t('register.termsLinkText')}
            </Link>{' '}
            {t('register.termsAnd')}{' '}
            <Link
              href="/privacy"
              target="_blank"
              style={{ color: 'var(--color-brand-primary)', textDecoration: 'underline' }}
            >
              {t('register.privacyLinkText')}
            </Link>
            {t('register.termsOutro')}
          </span>
        </label>

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
          type="button"
          onClick={handleAccept}
          disabled={submitting || !accepted}
          style={{
            width: '100%',
            padding: '12px 16px',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '0.02em',
            color: '#ffffff',
            backgroundColor:
              submitting || !accepted
                ? 'color-mix(in srgb, var(--color-brand-primary) 60%, transparent)'
                : 'var(--color-brand-primary)',
            border: 'none',
            borderRadius: 8,
            cursor: submitting || !accepted ? 'not-allowed' : 'pointer',
            transition: 'background-color 150ms ease, transform 150ms ease',
          }}
        >
          {submitting ? t('termsGate.submitting') : t('termsGate.submit')}
        </button>

        <p
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            textAlign: 'center',
            marginTop: 14,
            marginBottom: 0,
          }}
        >
          {t('termsGate.effective')} {TERMS_EFFECTIVE_DATE_LABEL}
        </p>
      </div>
    </div>
  );
}
