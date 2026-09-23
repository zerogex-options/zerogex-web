'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useLanguage, usePageT } from '@/core/LanguageContext';
import { CANCELLATION_FEEDBACK_LABELS } from '@/core/cancellationReason';
import { dict } from './MoneyBackGuaranteePanel.i18n';

// The Account page's self-serve 7-day money-back guarantee. Renders nothing
// unless GET /api/billing/money-back says this member can use it right now (or
// has an unfinished request to complete), so it is invisible to trials, to
// renewals, and once the window has closed. All eligibility is decided — and
// re-decided on submit — server-side (core/moneyBackServer.ts); this component
// owns only the steps and the copy.

type Status =
  | {
      state: 'eligible';
      deadlineIso: string;
      amountFormatted: string;
      planLabel: string;
    }
  | { state: 'unfinished' }
  | { state: 'ineligible' };

type Step = 'offer' | 'confirm' | 'working' | 'done' | 'done_follow_up';

const C = {
  light: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
  amber: 'var(--color-brand-primary)',
  border: 'var(--color-border)',
};

async function fetchCsrf(): Promise<string | null> {
  try {
    const r = await fetch('/api/auth/csrf', { credentials: 'include' });
    const j = (await r.json()) as { csrfToken?: string };
    return j?.csrfToken ?? null;
  } catch {
    return null;
  }
}

export default function MoneyBackGuaranteePanel({
  enabled,
  onRefunded,
}: {
  // Only look when there is a subscription (or the member may have an
  // unfinished request); skips the request entirely for everyone else.
  enabled: boolean;
  // Refresh the session + billing status once access has ended.
  onRefunded: () => void;
}) {
  const t = usePageT(dict);
  const { locale } = useLanguage();
  const [status, setStatus] = useState<Status | null>(null);
  const [step, setStep] = useState<Step>('offer');
  const [feedback, setFeedback] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refundedAmount, setRefundedAmount] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/billing/money-back', { credentials: 'include' });
        if (!response.ok) return;
        const data = (await response.json()) as Status;
        if (!cancelled) setStatus(data);
      } catch {
        // Non-critical: the panel simply stays hidden.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const submit = useCallback(async () => {
    setError(null);
    setStep('working');
    // On failure, return to where the member started: the confirm form for a
    // new request, the retry button for an unfinished one.
    const backTo: Step = status?.state === 'unfinished' ? 'offer' : 'confirm';
    const csrf = await fetchCsrf();
    if (!csrf) {
      setError(t('failed'));
      setStep(backTo);
      return;
    }
    try {
      const response = await fetch('/api/billing/money-back', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({
          ...(feedback ? { feedback } : {}),
          ...(comment.trim() ? { comment: comment.trim() } : {}),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        amountFormatted?: string;
        followUp?: boolean;
      };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? t('failed'));
        setStep(backTo);
        return;
      }
      setRefundedAmount(payload.amountFormatted ?? null);
      setStep(payload.followUp ? 'done_follow_up' : 'done');
      onRefunded();
    } catch {
      setError(t('failed'));
      setStep(backTo);
    }
  }, [comment, feedback, onRefunded, status?.state, t]);

  if (!enabled || !status || status.state === 'ineligible') {
    // Keep the confirmation visible after a refund even though a re-fetch would
    // now say "ineligible".
    if (step !== 'done' && step !== 'done_follow_up') return null;
  }

  const deadline =
    status?.state === 'eligible'
      ? (() => {
          const d = new Date(status.deadlineIso);
          if (Number.isNaN(d.getTime())) return status.deadlineIso;
          try {
            return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(d);
          } catch {
            return d.toLocaleString();
          }
        })()
      : null;
  const amount = status?.state === 'eligible' ? status.amountFormatted : refundedAmount ?? '';

  const buttonStyle = (primary: boolean) =>
    ({
      border: primary ? 'none' : `1px solid ${C.border}`,
      background: primary ? 'var(--color-bear)' : 'transparent',
      color: primary ? '#fff' : C.light,
      borderRadius: 10,
      padding: '9px 16px',
      fontWeight: 700,
      fontSize: 13,
      cursor: step === 'working' ? 'wait' : 'pointer',
      opacity: step === 'working' ? 0.7 : 1,
    }) as const;

  return (
    <div
      style={{
        marginTop: 16,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '14px 16px',
        background: 'var(--color-surface)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: C.light, fontSize: 14 }}>
        <ShieldCheck size={16} style={{ color: C.amber }} aria-hidden />
        {t('title')}
      </div>

      {(step === 'done' || step === 'done_follow_up') && (
        <p role="status" style={{ margin: '8px 0 0', color: C.light, fontSize: 13, lineHeight: 1.6 }}>
          {t(step === 'done' ? 'done' : 'doneFollowUp', { amount: refundedAmount ?? amount })}
        </p>
      )}

      {step !== 'done' && step !== 'done_follow_up' && status?.state === 'unfinished' && (
        <>
          <p style={{ margin: '8px 0 12px', color: C.muted, fontSize: 13, lineHeight: 1.6 }}>{t('unfinishedBody')}</p>
          <button type="button" style={buttonStyle(true)} disabled={step === 'working'} onClick={() => void submit()}>
            {step === 'working' ? t('working') : t('retry')}
          </button>
        </>
      )}

      {step === 'offer' && status?.state === 'eligible' && (
        <>
          <p style={{ margin: '8px 0 12px', color: C.muted, fontSize: 13, lineHeight: 1.6 }}>
            {t('body', { amount, plan: status.planLabel, deadline: deadline ?? '' })}
          </p>
          <button type="button" style={buttonStyle(false)} onClick={() => setStep('confirm')}>
            {t('request')}
          </button>
        </>
      )}

      {(step === 'confirm' || step === 'working') && status?.state === 'eligible' && (
        <div style={{ marginTop: 8 }}>
          <p style={{ margin: '0 0 4px', color: C.light, fontSize: 14, fontWeight: 700 }}>
            {t('confirmHeading', { amount })}
          </p>
          <p style={{ margin: '0 0 12px', color: C.muted, fontSize: 13, lineHeight: 1.6 }}>{t('confirmBody')}</p>
          <label style={{ display: 'block', fontSize: 12, color: C.muted, marginBottom: 6 }}>
            {t('reasonLabel')}
            <select
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              disabled={step === 'working'}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 4,
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: 'transparent',
                color: C.light,
                fontSize: 13,
              }}
            >
              <option value="">{t('reasonPlaceholder')}</option>
              {Object.entries(CANCELLATION_FEEDBACK_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            disabled={step === 'working'}
            placeholder={t('commentPlaceholder')}
            maxLength={500}
            rows={2}
            style={{
              display: 'block',
              width: '100%',
              marginTop: 8,
              padding: '8px 10px',
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: 'transparent',
              color: C.light,
              fontSize: 13,
              resize: 'vertical',
            }}
          />
          {error && (
            <p role="alert" style={{ margin: '10px 0 0', color: 'var(--color-bear)', fontSize: 13, fontWeight: 600 }}>
              {error}
            </p>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" style={buttonStyle(true)} disabled={step === 'working'} onClick={() => void submit()}>
              {step === 'working' ? t('working') : t('confirm')}
            </button>
            <button
              type="button"
              style={buttonStyle(false)}
              disabled={step === 'working'}
              onClick={() => {
                setError(null);
                setStep('offer');
              }}
            >
              {t('keep')}
            </button>
          </div>
        </div>
      )}

      {step !== 'confirm' && step !== 'working' && error && (
        <p role="alert" style={{ margin: '10px 0 0', color: 'var(--color-bear)', fontSize: 13, fontWeight: 600 }}>
          {error}
        </p>
      )}
    </div>
  );
}
