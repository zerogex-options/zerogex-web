'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePageT } from '@/core/LanguageContext';
import { CANCELLATION_FEEDBACK_LABELS } from '@/core/cancellationReason';
import { dict } from './CancelRetentionModal.i18n';

// In-app cancellation RETENTION flow. Opened from the account page's "Cancel
// subscription" button, it intercepts the member at the moment of cancel intent —
// the highest-converting retention moment — instead of deep-linking straight to
// Stripe's one-click portal cancel. Offer 25% off first; only if they decline do
// we capture a reason and schedule the cancel (forwarding the reason to Stripe so
// the webhook's existing ack-email + "Why Members Cancel" logging still fire).
//
// All billing mutations go through POST /api/billing/cancel-flow (CSRF + session
// gated). This component owns no billing logic — just the steps and the copy.

// Mirrors SAVE_PERCENT in core/retentionOffer.ts (kept local so this client
// component never imports the server-only Stripe module). The server is the
// source of truth and echoes the real percentOff back on success.
const SAVE_PERCENT = 25;

type Step = 'offer' | 'reason' | 'pause' | 'saved' | 'cancelled' | 'paused';

type Props = {
  open: boolean;
  onClose: () => void;
  // Fired after a terminal action so the parent can refresh billing status.
  onChanged: () => void;
  // ISO of the current period end, for the "charged/access until {date}" copy.
  periodEndIso: string | null;
  // Whether the one-shot 25%-off save offer is still claimable. When false, the
  // flow skips the offer step and goes straight to reason + cancel.
  offerAvailable: boolean;
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function fetchCsrf(): Promise<string | null> {
  try {
    const r = await fetch('/api/auth/csrf', { credentials: 'include' });
    const j = (await r.json()) as { csrfToken?: string };
    return j?.csrfToken ?? null;
  } catch {
    return null;
  }
}

export default function CancelRetentionModal({
  open,
  onClose,
  onChanged,
  periodEndIso,
  offerAvailable,
}: Props) {
  const t = usePageT(dict);
  const [step, setStep] = useState<Step>(offerAvailable ? 'offer' : 'reason');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [resumeLabel, setResumeLabel] = useState<string | null>(null);

  const endDate = formatDate(periodEndIso);

  // Reset to the entry step each time the modal is (re)opened.
  useEffect(() => {
    if (open) {
      setStep(offerAvailable ? 'offer' : 'reason');
      setBusy(false);
      setError(null);
      setFeedback(null);
      setComment('');
      setResumeLabel(null);
    }
  }, [open, offerAvailable]);

  // Escape to close (never mid-request), and lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, busy, onClose]);

  const applyDiscount = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const csrf = await fetchCsrf();
      if (!csrf) {
        setError(t('genericError'));
        return;
      }
      const res = await fetch('/api/billing/cancel-flow', {
        method: 'POST',
        headers: { 'x-csrf-token': csrf, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'discount' }),
      });
      if (res.ok) {
        setStep('saved');
        onChanged();
        return;
      }
      // Not eligible (already claimed / unmapped price / not offerable): can't
      // apply the discount, so fall through to letting them cancel.
      if (res.status === 409) {
        setStep('reason');
        return;
      }
      setError(t('genericError'));
    } catch {
      setError(t('genericError'));
    } finally {
      setBusy(false);
    }
  }, [onChanged, t]);

  const submitCancel = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const csrf = await fetchCsrf();
      if (!csrf) {
        setError(t('genericError'));
        return;
      }
      const res = await fetch('/api/billing/cancel-flow', {
        method: 'POST',
        headers: { 'x-csrf-token': csrf, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'cancel',
          feedback: feedback ?? undefined,
          comment: comment.trim() || undefined,
        }),
      });
      if (res.ok) {
        setStep('cancelled');
        onChanged();
        return;
      }
      setError(t('genericError'));
    } catch {
      setError(t('genericError'));
    } finally {
      setBusy(false);
    }
  }, [feedback, comment, onChanged, t]);

  const submitPause = useCallback(
    async (months: number) => {
      setBusy(true);
      setError(null);
      try {
        const csrf = await fetchCsrf();
        if (!csrf) {
          setError(t('genericError'));
          return;
        }
        const res = await fetch('/api/billing/cancel-flow', {
          method: 'POST',
          headers: { 'x-csrf-token': csrf, 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ action: 'pause', months }),
        });
        if (res.ok) {
          const data = (await res.json().catch(() => ({}))) as { resumesAt?: string };
          setResumeLabel(formatDate(data.resumesAt ?? null));
          setStep('paused');
          onChanged();
          return;
        }
        setError(t('genericError'));
      } catch {
        setError(t('genericError'));
      } finally {
        setBusy(false);
      }
    },
    [onChanged, t],
  );

  if (!open) return null;

  const pct = String(SAVE_PERCENT);

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        // Backdrop click closes (only the backdrop itself, never mid-request).
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(6, 14, 22, 0.66)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('dialogAria')}
        style={{
          width: '100%',
          maxWidth: 460,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 16,
          padding: '26px 24px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
          color: 'var(--color-text-primary)',
        }}
      >
        {step === 'offer' && (
          <>
            <h2 style={headingStyle}>{t('offerHeading', { pct })}</h2>
            <p style={bodyStyle}>
              {endDate ? t('offerBody', { pct, date: endDate }) : t('offerBodyNoDate', { pct })}
            </p>
            <div style={buttonColumn}>
              <button
                type="button"
                onClick={applyDiscount}
                disabled={busy}
                style={primaryButtonStyle(busy)}
              >
                {busy ? t('applying') : t('applyDiscount', { pct })}
              </button>
              <button
                type="button"
                onClick={() => setStep('pause')}
                disabled={busy}
                style={secondaryButtonStyle(busy)}
              >
                {t('pauseInstead')}
              </button>
              <button
                type="button"
                onClick={() => setStep('reason')}
                disabled={busy}
                style={linkButtonStyle}
              >
                {t('declineToCancel')}
              </button>
            </div>
          </>
        )}

        {step === 'reason' && (
          <>
            <h2 style={headingStyle}>{t('reasonHeading')}</h2>
            <p style={bodyStyle}>{t('reasonBody')}</p>
            <div style={{ display: 'grid', gap: 8, margin: '4px 0 14px' }}>
              {Object.entries(CANCELLATION_FEEDBACK_LABELS).map(([value, label]) => {
                const selected = feedback === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFeedback(selected ? null : value)}
                    aria-pressed={selected}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1px solid ${selected ? 'var(--color-brand-primary)' : 'var(--color-border)'}`,
                      background: selected ? 'var(--bg-active)' : 'transparent',
                      color: 'var(--color-text-primary)',
                      fontSize: 14,
                      fontWeight: selected ? 700 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('reasonCommentPlaceholder')}
              rows={3}
              maxLength={500}
              style={{
                width: '100%',
                resize: 'vertical',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
                fontSize: 14,
                fontFamily: 'inherit',
                marginBottom: 14,
              }}
            />
            <div style={buttonColumn}>
              <button
                type="button"
                onClick={() => setStep('pause')}
                disabled={busy}
                style={secondaryButtonStyle(busy)}
              >
                {t('pauseInstead')}
              </button>
              <button
                type="button"
                onClick={submitCancel}
                disabled={busy}
                style={destructiveButtonStyle(busy)}
              >
                {busy ? t('cancelling') : t('confirmCancel')}
              </button>
              <button type="button" onClick={onClose} disabled={busy} style={linkButtonStyle}>
                {t('keepPlan')}
              </button>
            </div>
          </>
        )}

        {step === 'pause' && (
          <>
            <h2 style={headingStyle}>{t('pauseHeading')}</h2>
            <p style={bodyStyle}>{t('pauseBody')}</p>
            <div style={{ display: 'flex', gap: 10, margin: '4px 0 18px' }}>
              {[1, 2, 3].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => submitPause(m)}
                  disabled={busy}
                  style={{
                    flex: 1,
                    padding: '14px 0',
                    borderRadius: 10,
                    border: '1px solid var(--color-brand-primary)',
                    background: 'transparent',
                    color: 'var(--color-text-primary)',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  {t(m === 1 ? 'pauseMonth' : 'pauseMonths', { n: String(m) })}
                </button>
              ))}
            </div>
            <div style={buttonColumn}>
              <button
                type="button"
                onClick={() => setStep('offer')}
                disabled={busy}
                style={linkButtonStyle}
              >
                {t('pauseBack')}
              </button>
            </div>
          </>
        )}

        {step === 'paused' && (
          <>
            <h2 style={headingStyle}>{t('pausedHeading')}</h2>
            <p style={bodyStyle}>
              {resumeLabel ? t('pausedBody', { date: resumeLabel }) : t('pausedBodyNoDate')}
            </p>
            <div style={buttonColumn}>
              <button type="button" onClick={onClose} style={primaryButtonStyle(false)}>
                {t('done')}
              </button>
            </div>
          </>
        )}

        {step === 'saved' && (
          <>
            <h2 style={headingStyle}>{t('savedHeading')}</h2>
            <p style={bodyStyle}>
              {endDate ? t('savedBody', { pct, date: endDate }) : t('savedBodyNoDate', { pct })}
            </p>
            <div style={buttonColumn}>
              <button type="button" onClick={onClose} style={primaryButtonStyle(false)}>
                {t('done')}
              </button>
            </div>
          </>
        )}

        {step === 'cancelled' && (
          <>
            <h2 style={headingStyle}>{t('cancelledHeading')}</h2>
            <p style={bodyStyle}>
              {endDate ? t('cancelledBody', { date: endDate }) : t('cancelledBodyNoDate')}
            </p>
            <div style={buttonColumn}>
              <button type="button" onClick={onClose} style={primaryButtonStyle(false)}>
                {t('done')}
              </button>
            </div>
          </>
        )}

        {error && (
          <p style={{ margin: '14px 0 0', color: 'var(--color-bear)', fontSize: 13 }}>{error}</p>
        )}
      </div>
    </div>
  );
}

const headingStyle: React.CSSProperties = {
  margin: '0 0 10px',
  fontSize: 20,
  fontWeight: 800,
  color: 'var(--color-text-primary)',
};

const bodyStyle: React.CSSProperties = {
  margin: '0 0 18px',
  fontSize: 14.5,
  lineHeight: 1.6,
  color: 'var(--color-text-secondary)',
};

const buttonColumn: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  alignItems: 'stretch',
};

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    background: 'linear-gradient(135deg, var(--color-brand-primary) 0%, var(--heat-mid) 100%)',
    border: 'none',
    color: 'var(--text-inverse)',
    borderRadius: 10,
    padding: '12px 18px',
    fontWeight: 800,
    fontSize: 15,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };
}

function secondaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    background: 'transparent',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)',
    borderRadius: 10,
    padding: '11px 18px',
    fontWeight: 700,
    fontSize: 14,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };
}

function destructiveButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    background: 'var(--color-bear)',
    border: '1px solid var(--color-bear)',
    color: 'var(--text-inverse, #ffffff)',
    borderRadius: 10,
    padding: '11px 18px',
    fontWeight: 800,
    fontSize: 14,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };
}

const linkButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--color-text-secondary)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  padding: '4px 0',
  textDecoration: 'underline',
};
