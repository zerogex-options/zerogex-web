'use client';

import { useState, useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './TrialStartedBanner.i18n';

// Post-checkout welcome. Stripe's success_url is /dashboard?trial_started=1;
// this shows a one-time, dismissible confirmation so the just-converted trialer
// gets a clear "you're in" moment. If the subscription webhook hasn't granted
// the tier yet, the dashboard's own data hooks fill in within a few seconds
// (they poll), so the banner reassures while that settles.
//
// The `trial_started` flag is read via useSyncExternalStore (server snapshot =
// false) rather than a mount effect — SSR-safe, no hydration mismatch, and no
// synchronous setState-in-effect.
const subscribe = () => () => {};
const readTrialStarted = () => {
  try {
    return new URLSearchParams(window.location.search).get('trial_started') === '1';
  } catch {
    // A malformed query string must never break the dashboard.
    return false;
  }
};
const readServer = () => false;

export default function TrialStartedBanner() {
  const trialStarted = useSyncExternalStore(subscribe, readTrialStarted, readServer);
  const [dismissed, setDismissed] = useState(false);
  const t = usePageT(dict);

  if (!trialStarted || dismissed) return null;

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
        {t('welcomeMessage')}{' '}
        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>
          {t('noChargeMessage')}
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
