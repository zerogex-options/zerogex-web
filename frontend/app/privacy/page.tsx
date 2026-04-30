'use client';

import Link from 'next/link';
import Footer from '@/components/Footer';
import { useTheme } from '@/core/ThemeContext';
import { Moon, ShieldCheck, Sun } from 'lucide-react';

const C = {
  card: 'var(--color-surface)',
  light: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
  amber: 'var(--color-brand-primary)',
  border: 'var(--border-default)',
};

const EFFECTIVE_DATE = 'April 25, 2026';
const CONTACT_EMAIL = 'support@zerogex.io';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 36 }}>
      <h2
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 800,
          color: C.light,
          letterSpacing: '-0.3px',
        }}
      >
        {title}
      </h2>
      <div style={{ marginTop: 12, color: C.muted, fontSize: 15, lineHeight: 1.75 }}>{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      style={{
        background: 'transparent',
        color: C.light,
        fontFamily: 'DM Sans, sans-serif',
        overflowX: 'hidden',
      }}
    >
      <nav
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-4 sm:px-8 h-14 sm:h-16"
        style={{
          background: `${isDark ? 'var(--color-bg)' : 'var(--color-bg)'}ee`,
          borderBottom: `1px solid ${C.border}`,
          backdropFilter: 'blur(20px)',
        }}
      >
        <Link
          href="/"
          className="h-full flex items-center overflow-hidden flex-shrink-0"
          style={{ textDecoration: 'none', lineHeight: 0 }}
        >
          <img
            src="/title.svg"
            alt="ZeroGEX"
            className="h-[130%] sm:h-[150%] w-auto block"
            style={{ maxHeight: 'none', objectFit: 'contain' }}
          />
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="w-8 h-8 sm:w-[38px] sm:h-[38px] flex items-center justify-center rounded-[10px]"
            style={{
              background: isDark ? `${C.card}cc` : 'var(--bg-hover)',
              border: `1px solid ${C.border}`,
              cursor: 'pointer',
              color: C.muted,
            }}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <Link href="/about" style={{ textDecoration: 'none' }}>
            <button
              style={{
                background: isDark ? `${C.card}cc` : 'var(--bg-hover)',
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 700,
                color: C.light,
                cursor: 'pointer',
              }}
            >
              About
            </button>
          </Link>
        </div>
      </nav>

      <main style={{ minHeight: '100vh', padding: '120px 24px 84px', position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(var(--border-subtle) 1px, transparent 1px),
              linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)
            `,
            backgroundSize: '62px 62px',
            pointerEvents: 'none',
          }}
        />
        <article style={{ position: 'relative', zIndex: 1, maxWidth: 820, margin: '0 auto' }}>
          <div style={{ marginBottom: 32 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                color: C.amber,
                border: `1px solid ${C.amber}55`,
                borderRadius: 999,
                background: `${C.amber}12`,
                padding: '5px 14px',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}
            >
              <ShieldCheck size={14} /> Privacy
            </div>
            <h1
              style={{
                margin: '18px 0 10px',
                fontSize: 'clamp(34px, 5vw, 56px)',
                lineHeight: 1.08,
                letterSpacing: '-1.2px',
              }}
            >
              Privacy Policy
            </h1>
            <p style={{ margin: 0, color: C.muted, fontSize: 14 }}>
              Effective date: {EFFECTIVE_DATE}
            </p>
          </div>

          <Section title="1. Introduction">
            <p>
              This Privacy Policy describes how ZeroGEX, LLC (&ldquo;ZeroGEX,&rdquo; &ldquo;we,&rdquo; or
              &ldquo;us&rdquo;) collects, uses, and shares information about you when you use the website at
              zerogex.io and related products and services (collectively, the &ldquo;Services&rdquo;). By using
              the Services, you agree to this Privacy Policy.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <p>We collect the following categories of information:</p>
            <ul style={{ paddingLeft: 22, marginTop: 8 }}>
              <li>
                <strong>Account information.</strong> Email address, password (stored as a salted hash), and, if
                you sign in with Google or Apple, the unique provider identifier and email returned by that
                provider.
              </li>
              <li>
                <strong>Subscription and payment information.</strong> Subscription tier, status, current
                billing period, and Stripe customer/subscription identifiers. Payment instruments (card numbers,
                expirations, billing addresses) are collected and processed by Stripe; we do not receive or
                store full card data.
              </li>
              <li>
                <strong>Usage and device information.</strong> IP address, request timestamps, pages visited,
                and basic browser/device metadata, used for security, abuse prevention, and product analytics.
              </li>
              <li>
                <strong>Audit events.</strong> Limited records of authentication and account-management actions
                (logins, role changes, subscription changes) for security and compliance.
              </li>
            </ul>
          </Section>

          <Section title="3. How We Use Information">
            <ul style={{ paddingLeft: 22 }}>
              <li>Provide, maintain, and improve the Services.</li>
              <li>Authenticate users and prevent fraud or abuse.</li>
              <li>Process subscriptions and payments via Stripe.</li>
              <li>Enforce tier-based access to features.</li>
              <li>Communicate with you about your account, billing, and material changes to the Services.</li>
              <li>Comply with legal obligations and respond to lawful requests.</li>
            </ul>
          </Section>

          <Section title="4. Third-Party Service Providers">
            <p>
              We share information with third parties that help us operate the Services. The principal
              providers are:
            </p>
            <ul style={{ paddingLeft: 22, marginTop: 8 }}>
              <li>
                <strong>Stripe</strong> — payment processing, billing portal, and subscription management.
                Stripe&rsquo;s privacy practices are described at{' '}
                <a href="https://stripe.com/privacy" target="_blank" rel="noreferrer" style={{ color: C.amber }}>
                  stripe.com/privacy
                </a>
                .
              </li>
              <li>
                <strong>Cloud infrastructure providers</strong> — hosting, storage, and content delivery for the
                Services.
              </li>
              <li>
                <strong>Identity providers</strong> — Google and Apple, when you choose to sign in with those
                services.
              </li>
            </ul>
            <p style={{ marginTop: 12 }}>
              We do not sell your personal information. We do not share personal information with third parties
              for their own marketing purposes.
            </p>
          </Section>

          <Section title="5. Cookies and Similar Technologies">
            <p>
              We use first-party cookies to keep you signed in (a session cookie) and to mitigate
              cross-site-request-forgery attacks (a CSRF cookie). Stripe-hosted pages set their own cookies
              under their domain, governed by Stripe&rsquo;s privacy policy. Most browsers allow you to refuse
              or delete cookies; however, doing so may make parts of the Services unusable.
            </p>
          </Section>

          <Section title="6. Data Retention">
            <p>
              We retain account, subscription, and audit information for as long as your account remains active
              and for a reasonable period afterward to comply with legal, tax, or accounting obligations and to
              resolve disputes. You may request deletion as described below.
            </p>
          </Section>

          <Section title="7. Your Rights">
            <p>
              Depending on where you live, you may have the right to access, correct, delete, or export your
              personal information, or to object to or restrict certain processing. To exercise any of these
              rights, contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: C.amber }}>
                {CONTACT_EMAIL}
              </a>
              . We may need to verify your identity before acting on a request. We will not discriminate against
              you for exercising any of these rights.
            </p>
          </Section>

          <Section title="8. Security">
            <p>
              We use technical and organizational measures designed to protect your information, including
              encryption in transit (TLS), salted password hashing, signed session tokens, and rate limiting on
              authentication endpoints. No method of transmission or storage is perfectly secure, and we cannot
              guarantee absolute security.
            </p>
          </Section>

          <Section title="9. International Transfers">
            <p>
              The Services are operated from the United States. If you access them from outside the United
              States, your information will be transferred to, processed in, and stored in the United States.
            </p>
          </Section>

          <Section title="10. Children">
            <p>
              The Services are not directed to children under 18. We do not knowingly collect personal
              information from children under 18. If you believe a child has provided us with personal
              information, please contact us so we can delete it.
            </p>
          </Section>

          <Section title="11. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. When we do, we will revise the effective date
              above and, where appropriate, provide additional notice through the Services.
            </p>
          </Section>

          <Section title="12. Contact">
            <p>
              Questions about this Privacy Policy can be sent to{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: C.amber }}>
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>
        </article>
      </main>

      <Footer theme={theme} />
    </div>
  );
}
