'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePageT } from '@/core/LanguageContext';
import { lockPageScroll } from '@/core/scrollLock';
import { CANCELLATION_COMMENT_MAX_LEN, CANCELLATION_FEEDBACK_LABELS } from '@/core/cancellationReason';
import { formatBilledUsd, formatPerMonthUsd, type BillableTier, type BillingCadence } from '@/core/billingPlans';
import type { LengthenOffer } from '@/core/planSwitch';
import { dict } from './CancelRetentionModal.i18n';

// In-app cancellation RETENTION flow, and the only way to cancel: the Stripe
// billing portal no longer offers Cancel. Opened from the account page's "Cancel
// subscription" button, it intercepts the member at the moment of cancel intent —
// the highest-converting retention moment. It offers 25% off and, to a paying
// monthly or quarterly member, a switch to a longer billing period; only if they
// decline do we capture a reason and schedule the cancel (forwarding the reason
// to Stripe so the webhook's existing ack-email + "Why Members Cancel" logging
// still fire).
//
// Cancel, discount and pause go through POST /api/billing/cancel-flow; a plan
// switch goes through POST /api/billing/change-plan, priced first and confirmed
// at the amount shown. Both are CSRF + session gated. This component owns no
// billing logic — just the steps and the copy.

// Mirrors SAVE_PERCENT in core/retentionOffer.ts (kept local so this client
// component never imports the server-only Stripe module). The server is the
// source of truth and echoes the real percentOff back on success.
const SAVE_PERCENT = 25;

type Step = 'offer' | 'reason' | 'pause' | 'switchConfirm' | 'switched' | 'saved' | 'canceled' | 'paused';

// A priced switch awaiting the member's confirmation (from change-plan).
type SwitchQuote = {
  tier: BillableTier;
  cadence: BillingCadence;
  amountDue: number;
  amountFormatted: string;
  prorationDate: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  // Fired after a terminal action so the parent can refresh billing status.
  onChanged: () => void;
  // ISO of the current period end, for the "charged/access until {date}" copy.
  periodEndIso: string | null;
  // Whether the one-shot 25%-off save offer is still claimable.
  offerAvailable: boolean;
  // Longer billing periods the member can switch to, longest first (from
  // /api/billing/status). Empty for anyone not paying monthly or quarterly.
  planOffers: LengthenOffer[];
  // Whether a pause can be offered (a live, unpaused subscription).
  canPause: boolean;
};

const TIER_NAME: Record<BillableTier, string> = { basic: 'Basic', pro: 'Pro' };

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function periodName(cadence: BillingCadence): string {
  return cadence === 'annual' ? 'annual' : cadence === 'quarterly' ? 'quarterly' : 'monthly';
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
  planOffers,
  canPause,
}: Props) {
  const t = usePageT(dict);
  // The offer step opens the flow whenever there is something to offer.
  const entryStep: Step = offerAvailable || planOffers.length > 0 ? 'offer' : 'reason';
  const [step, setStep] = useState<Step>(entryStep);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [resumeLabel, setResumeLabel] = useState<string | null>(null);
  const [quote, setQuote] = useState<SwitchQuote | null>(null);
  const [quoteNotice, setQuoteNotice] = useState<string | null>(null);

  const endDate = formatDate(periodEndIso);

  // Reset to the entry step each time the modal is opened, and only then. A
  // save or a switch refreshes the billing status behind the open modal, which
  // changes what there is to offer; resetting on that would replace the
  // confirmation the member is reading with the start of the flow.
  const wasOpen = useRef(false);
  useEffect(() => {
    const opening = open && !wasOpen.current;
    wasOpen.current = open;
    if (opening) {
      setStep(entryStep);
      setBusy(false);
      setError(null);
      setPortalUrl(null);
      setFeedback(null);
      setComment('');
      setResumeLabel(null);
      setQuote(null);
      setQuoteNotice(null);
    }
  }, [open, entryStep]);

  // Escape to close (never mid-request), and lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    const releaseScroll = lockPageScroll();
    return () => {
      document.removeEventListener('keydown', onKey);
      releaseScroll();
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
        setStep('canceled');
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

  // Price a switch (no confirm) or make it (confirm at the quoted amount and
  // instant). The server answers with a quote to confirm, the switch, or a URL
  // to follow (the billing portal, when the switch can't be made in-app).
  const requestSwitch = useCallback(
    async (offer: { tier: BillableTier; cadence: BillingCadence }, confirm: SwitchQuote | null) => {
      setBusy(true);
      setError(null);
      setPortalUrl(null);
      try {
        const csrf = await fetchCsrf();
        if (!csrf) {
          setError(t('genericError'));
          return;
        }
        const res = await fetch('/api/billing/change-plan', {
          method: 'POST',
          headers: { 'x-csrf-token': csrf, 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            tier: offer.tier,
            cadence: offer.cadence,
            source: 'cancel_flow',
            ...(confirm
              ? { confirm: true, expectedAmountDue: confirm.amountDue, prorationDate: confirm.prorationDate }
              : {}),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          url?: string;
          error?: string;
          portalUrl?: string;
          switched?: { tier: BillableTier; cadence: BillingCadence };
          confirm?: Partial<SwitchQuote>;
        };
        const next = data.confirm;
        if (
          (res.ok || res.status === 409) &&
          next &&
          typeof next.amountDue === 'number' &&
          typeof next.amountFormatted === 'string' &&
          typeof next.prorationDate === 'number'
        ) {
          setQuote({
            tier: offer.tier,
            cadence: offer.cadence,
            amountDue: next.amountDue,
            amountFormatted: next.amountFormatted,
            prorationDate: next.prorationDate,
          });
          // A 409 means the price moved since the member looked.
          setQuoteNotice(res.status === 409 ? (data.error ?? null) : null);
          setStep('switchConfirm');
          return;
        }
        if (res.ok && data.switched) {
          setStep('switched');
          onChanged();
          return;
        }
        if (res.ok && data.url) {
          window.location.href = data.url;
          return;
        }
        setError(data.error ?? t('genericError'));
        setPortalUrl(data.portalUrl ?? null);
      } catch {
        setError(t('genericError'));
      } finally {
        setBusy(false);
      }
    },
    [onChanged, t],
  );

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
            {offerAvailable ? (
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
                </div>
              </>
            ) : (
              <>
                <h2 style={headingStyle}>{t('plansHeading')}</h2>
                <p style={bodyStyle}>{t('plansBody')}</p>
              </>
            )}
            {planOffers.length > 0 && (
              <>
                {offerAvailable && <p style={subheadingStyle}>{t('plansSubheading')}</p>}
                <div style={{ ...buttonColumn, marginBottom: 10 }}>
                  {planOffers.map((offer) => (
                    <button
                      key={offer.cadence}
                      type="button"
                      onClick={() => requestSwitch(offer, null)}
                      disabled={busy}
                      style={offerButtonStyle(busy)}
                    >
                      <span style={{ display: 'block', fontWeight: 800, fontSize: 15 }}>
                        {t(offer.cadence === 'annual' ? 'planOfferAnnual' : 'planOfferQuarterly', {
                          tier: TIER_NAME[offer.tier],
                          price: formatBilledUsd(offer.listPrice),
                        })}
                      </span>
                      <span style={{ display: 'block', marginTop: 2, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                        {t('planOfferPerMonth', { perMonth: formatPerMonthUsd(offer.perMonth) })}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <div style={buttonColumn}>
              {canPause && (
                <button
                  type="button"
                  onClick={() => setStep('pause')}
                  disabled={busy}
                  style={secondaryButtonStyle(busy)}
                >
                  {t('pauseInstead')}
                </button>
              )}
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

        {step === 'switchConfirm' && quote && (
          <>
            <h2 style={headingStyle}>
              {t('switchConfirmHeading', { tier: TIER_NAME[quote.tier], period: periodName(quote.cadence) })}
            </h2>
            {quoteNotice && <p style={{ ...bodyStyle, color: 'var(--color-text-primary)' }}>{quoteNotice}</p>}
            <p style={bodyStyle}>
              {t(quote.cadence === 'annual' ? 'switchConfirmBodyAnnual' : 'switchConfirmBodyQuarterly', {
                amount: quote.amountFormatted,
              })}
            </p>
            <div style={buttonColumn}>
              <button
                type="button"
                onClick={() => requestSwitch(quote, quote)}
                disabled={busy}
                style={primaryButtonStyle(busy)}
              >
                {busy ? t('switching') : t('confirmSwitch', { amount: quote.amountFormatted })}
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setPortalUrl(null);
                  setStep('offer');
                }}
                disabled={busy}
                style={linkButtonStyle}
              >
                {t('switchBack')}
              </button>
            </div>
          </>
        )}

        {step === 'switched' && quote && (
          <>
            <h2 style={headingStyle}>
              {t('switchedHeading', { tier: TIER_NAME[quote.tier], period: periodName(quote.cadence) })}
            </h2>
            <p style={bodyStyle}>
              {t(quote.cadence === 'annual' ? 'switchedBodyAnnual' : 'switchedBodyQuarterly')}
            </p>
            <div style={buttonColumn}>
              <button type="button" onClick={onClose} style={primaryButtonStyle(false)}>
                {t('done')}
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
              maxLength={CANCELLATION_COMMENT_MAX_LEN}
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
              {canPause && (
                <button
                  type="button"
                  onClick={() => setStep('pause')}
                  disabled={busy}
                  style={secondaryButtonStyle(busy)}
                >
                  {t('pauseInstead')}
                </button>
              )}
              <button
                type="button"
                onClick={submitCancel}
                disabled={busy}
                style={destructiveButtonStyle(busy)}
              >
                {busy ? t('canceling') : t('confirmCancel')}
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
                onClick={() => setStep(entryStep)}
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

        {step === 'canceled' && (
          <>
            <h2 style={headingStyle}>{t('canceledHeading')}</h2>
            <p style={bodyStyle}>
              {endDate ? t('canceledBody', { date: endDate }) : t('canceledBodyNoDate')}
            </p>
            <div style={buttonColumn}>
              <button type="button" onClick={onClose} style={primaryButtonStyle(false)}>
                {t('done')}
              </button>
            </div>
          </>
        )}

        {error && (
          <p style={{ margin: '14px 0 0', color: 'var(--color-bear)', fontSize: 13 }}>
            {error}
            {portalUrl && (
              <>
                {' '}
                <a href={portalUrl} style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>
                  {t('switchPortalLink')}
                </a>
              </>
            )}
          </p>
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

const subheadingStyle: React.CSSProperties = {
  margin: '18px 0 10px',
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--color-text-primary)',
};

// A plan offer: a two-line choice, quieter than the primary save button.
function offerButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    textAlign: 'left',
    background: 'transparent',
    border: '1px solid var(--color-brand-primary)',
    color: 'var(--color-text-primary)',
    borderRadius: 10,
    padding: '11px 14px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };
}

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
