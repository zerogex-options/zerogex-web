'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Footer from '@/components/Footer';
import LandingHeader from '@/components/LandingHeader';
import { useTheme } from '@/core/ThemeContext';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

const C = {
  card: 'var(--color-surface)',
  light: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
  amber: 'var(--color-brand-primary)',
  border: 'var(--border-default)',
};

type Props = {
  premiumCheckoutUrl: string;
};

// Post-subscribe confirmation page. Beehiiv sends a double-opt-in email
// automatically; this page tells the visitor to go check their inbox
// and offers the paid-upgrade cross-sell while it's fresh.
//
// The subscribe route sends {ok:true, redirect:'/newsletter/confirmed'}
// so the client can push the visitor here without exposing any Beehiiv
// state to the browser.  If the visitor arrives with ?email=…, we
// pre-fill it into the Beehiiv paid-checkout URL so their subscription
// stitches to the same address they used for the free tier.
export default function ConfirmedClient({ premiumCheckoutUrl }: Props) {
  const { theme } = useTheme();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';

  const upgradeUrl = premiumCheckoutUrl
    ? withPrefill(premiumCheckoutUrl, email)
    : null;

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', color: C.light, minHeight: '100vh' }}>
      <LandingHeader />
      <main
        style={{
          padding: '96px 24px 64px',
          maxWidth: 640,
          margin: '0 auto',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 64, height: 64,
            borderRadius: '50%',
            backgroundColor: 'var(--color-brand-primary-soft, rgba(245,180,0,0.15))',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <CheckCircle2 size={32} color={C.amber} />
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.5px', margin: '0 0 12px' }}>
          You&apos;re in — almost.
        </h1>
        <p style={{ fontSize: 17, color: C.muted, margin: '0 0 24px', lineHeight: 1.5 }}>
          Check your inbox for a confirmation link from Beehiiv.
          The first GEX Morning Card lands before the next trading morning.
        </p>

        {upgradeUrl && (
          <div
            style={{
              marginTop: 40,
              padding: 24,
              border: `1px solid ${C.border}`,
              borderRadius: 16,
              backgroundColor: C.card,
              textAlign: 'left',
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px' }}>
              While you&apos;re here — the Sunday Playbook Review.
            </h2>
            <p style={{ color: C.muted, fontSize: 14, margin: '0 0 20px', lineHeight: 1.5 }}>
              Once a week you get the full pattern-accuracy leaderboard, a
              deep dive on one playbook that fired, and a backtest post-mortem.
              $15 / month, billed by Beehiiv.
            </p>
            <a
              href={upgradeUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 22px',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 800,
                textDecoration: 'none',
                color: 'var(--text-inverse)',
                background: `linear-gradient(135deg, ${C.amber} 0%, var(--heat-mid) 100%)`,
              }}
            >
              Upgrade — $15/mo <ArrowRight size={16} />
            </a>
          </div>
        )}

        <p style={{ marginTop: 40, fontSize: 13, color: C.muted }}>
          Didn&apos;t mean to subscribe?{' '}
          <Link href="/newsletter" style={{ color: C.amber }}>
            Back to the newsletter page →
          </Link>
        </p>
      </main>
      <Footer theme={theme} />
    </div>
  );
}

function withPrefill(baseUrl: string, email: string): string {
  if (!email) return baseUrl;
  try {
    const url = new URL(baseUrl);
    // Beehiiv's hosted checkout accepts an ``email`` query param to pre-fill
    // the payer's email field.  This does NOT authenticate the visitor —
    // it just saves them a re-type.
    url.searchParams.set('email', email);
    return url.toString();
  } catch {
    return baseUrl;
  }
}
