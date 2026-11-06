'use client';

import { useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { useLanguage, usePageT } from '@/core/LanguageContext';
import { dict } from './NoCardTrialBanner.i18n';

// A standing reminder on the dashboard for a member whose trial started without
// a card and still has none (core/noCardTrial.ts): when it ends, and one link to
// add a card on the account page. The trial-end email says the same thing once;
// this is where a member who is using the product will actually see it.
//
// Reads /api/billing/status, which answers from the users row alone (the
// webhook stamps the no-card columns), so this costs no Stripe call. Renders
// nothing for everyone else, and nothing while the post-checkout welcome banner
// is up, which already says it.
type NoCardTrial = { trialEndIso: string | null; cardAdded: boolean } | null;

export default function NoCardTrialBanner() {
  const [noCardTrial, setNoCardTrial] = useState<NoCardTrial>(null);
  const { locale } = useLanguage();
  const t = usePageT(dict);

  useEffect(() => {
    let cancelled = false;
    try {
      if (new URLSearchParams(window.location.search).get('trial_started') === '1') return;
    } catch {
      // A malformed query string must never break the dashboard.
    }
    fetch('/api/billing/status', { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { noCardTrial?: NoCardTrial } | null) => {
        if (!cancelled) setNoCardTrial(data?.noCardTrial ?? null);
      })
      .catch(() => {
        // Non-critical: no banner is the safe outcome.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!noCardTrial || noCardTrial.cardAdded || !noCardTrial.trialEndIso) return null;
  const end = new Date(noCardTrial.trialEndIso);
  if (Number.isNaN(end.getTime())) return null;
  const date = end.toLocaleDateString(locale, {
    month: 'long',
    day: 'numeric',
    timeZone: 'America/New_York',
  });

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        margin: '0 0 16px',
        padding: '12px 16px',
        borderRadius: 12,
        border: '1px solid var(--color-brand-primary)',
        background: 'var(--color-brand-primary-soft, rgba(245,180,0,0.10))',
        color: 'var(--color-text-primary)',
      }}
    >
      <span style={{ flex: '1 1 260px', minWidth: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>
        {t('message', { date })}
      </span>
      <a
        href="/account?add_card=1"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          borderRadius: 10,
          background: 'var(--color-brand-primary)',
          color: 'var(--text-inverse)',
          fontWeight: 800,
          fontSize: 13,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        <CreditCard size={14} /> {t('cta')}
      </a>
    </div>
  );
}
