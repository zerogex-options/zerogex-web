'use client';

import { useState, useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './TrialStartedBanner.i18n';
import { resolveTrialStartedCopy } from './trialStartedCopy';

// Post-checkout welcome. Stripe's success_url is
// /dashboard?trial_started=1&trial=<what checkout granted>; this shows a
// one-time, dismissible confirmation so the just-converted member gets a clear
// "you're in" moment. If the subscription webhook hasn't granted the tier yet,
// the dashboard's own data hooks fill in within a few seconds (they poll), so
// the banner reassures while that settles.
//
// `trial` describes the trial itself and drives which of the three messages
// renders (see ./trialStartedCopy). It is read from the URL rather than from
// the session because the banner's whole job is the window BEFORE the webhook
// syncs — at first paint the account may not know it has a trial yet, but the
// checkout that just redirected here knows exactly what it granted.
//
// Both params are read via useSyncExternalStore (server snapshot = null)
// rather than a mount effect — SSR-safe, no hydration mismatch, and no
// synchronous setState-in-effect. The snapshot is a string (or null), never an
// object: useSyncExternalStore compares snapshots with Object.is, so a fresh
// object on every call would re-render forever.
const subscribe = () => () => {};
const readTrialParam = (): string | null => {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('trial_started') !== '1') return null;
    // '' rather than null when `trial` is absent, so "post-checkout, trial
    // undescribed" stays distinguishable from "not a post-checkout view".
    return params.get('trial') ?? '';
  } catch {
    // A malformed query string must never break the dashboard.
    return null;
  }
};
const readServer = (): string | null => null;

export default function TrialStartedBanner() {
  const trialParam = useSyncExternalStore(subscribe, readTrialParam, readServer);
  const [dismissed, setDismissed] = useState(false);
  const t = usePageT(dict);

  if (trialParam === null || dismissed) return null;

  const copy = resolveTrialStartedCopy(trialParam);
  const [welcomeMessage, billingMessage] =
    copy.variant === 'days'
      ? [t('welcomeDays', { days: copy.days }), t('billingDays', { days: copy.days })]
      : copy.variant === 'deferred'
        ? [t('welcomeDeferred'), t('billingDeferred')]
        : [t('welcomeNone'), t('billingNone')];

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        margin: '0 0 16px',
        padding: '12px 16px',
        borderRadius: 12,
        border: '1px solid var(--color-brand-primary)',
        background: 'var(--color-brand-primary-soft, rgba(245,180,0,0.10))',
        color: 'var(--color-text-primary)',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>
        {welcomeMessage}{' '}
        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>
          {billingMessage}
        </span>
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={t('dismiss')}
        style={{
          flexShrink: 0,
          width: 30,
          height: 30,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--border-default)',
          background: 'transparent',
          color: 'var(--color-text-secondary)',
          borderRadius: 8,
          cursor: 'pointer',
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
