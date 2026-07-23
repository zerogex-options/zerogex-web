import type { Metadata } from 'next';
import Link from 'next/link';
import AmbassadorTerms from '@/components/AmbassadorTerms';
import { getAmbassadorTermsVersion, getAmbassadorTerms } from '@/core/ambassadorConfig';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'ZeroGEX Ambassador Program Terms',
  description:
    'An invite-only program for trusted ZeroGEX customers who actively support and recommend the platform.',
  robots: { index: false, follow: true },
};

const C = {
  text: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
  border: 'var(--color-border)',
  amber: 'var(--color-brand-primary)',
  surface: 'var(--color-surface)',
};

export default function AmbassadorTermsPage() {
  const version = getAmbassadorTermsVersion();
  const terms = getAmbassadorTerms();
  return (
    <main style={{ minHeight: '100vh', padding: '48px 24px', color: C.text }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <header style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: '-0.5px' }}>
            ZeroGEX Ambassador Program
          </h1>
          <p style={{ margin: '10px 0 0', color: C.muted, fontSize: 15, lineHeight: 1.6 }}>
            An invite-only program for trusted ZeroGEX customers who actively support and recommend the
            platform. Ambassadors are not employees, agents, investment advisers, financial
            professionals, or official representatives of ZeroGEX.
          </p>
        </header>

        <section
          style={{
            background: `linear-gradient(145deg, ${C.surface} 0%, var(--bg-active) 100%)`,
            border: `1px solid ${C.border}`,
            borderRadius: 16,
            padding: 24,
          }}
        >
          <AmbassadorTerms
            version={version}
            commissionPct={terms.commissionBps / 100}
            creditPct={terms.creditBps / 100}
            commissionDurationMonths={terms.commissionWindowMonths}
            holdingPeriodDays={terms.holdingPeriodDays}
            attributionWindowDays={terms.attributionWindowDays}
          />
        </section>

        <p style={{ marginTop: 20, color: C.muted, fontSize: 13 }}>
          Already an ambassador?{' '}
          <Link href="/account/ambassador" style={{ color: C.amber, fontWeight: 700, textDecoration: 'none' }}>
            Open your dashboard
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
