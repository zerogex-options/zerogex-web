'use client';

import Link from 'next/link';
import Footer from '@/components/Footer';
import { useTheme } from '@/core/ThemeContext';
import { FileText, Moon, Sun } from 'lucide-react';

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

export default function TermsPage() {
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
              <FileText size={14} /> Legal
            </div>
            <h1
              style={{
                margin: '18px 0 10px',
                fontSize: 'clamp(34px, 5vw, 56px)',
                lineHeight: 1.08,
                letterSpacing: '-1.2px',
              }}
            >
              Terms of Service
            </h1>
            <p style={{ margin: 0, color: C.muted, fontSize: 14 }}>
              Effective date: {EFFECTIVE_DATE}
            </p>
          </div>

          <Section title="1. Acceptance of Terms">
            <p>
              These Terms of Service (&ldquo;Terms&rdquo;) form a binding agreement between you and ZeroGEX, LLC
              (&ldquo;ZeroGEX,&rdquo; &ldquo;we,&rdquo; or &ldquo;us&rdquo;). By creating an account or using
              the website at zerogex.io and any related products and services (collectively, the
              &ldquo;Services&rdquo;), you accept these Terms and our{' '}
              <Link href="/privacy" style={{ color: C.amber }}>
                Privacy Policy
              </Link>
              . If you do not agree, do not use the Services.
            </p>
          </Section>

          <Section title="2. Eligibility">
            <p>
              You must be at least 18 years old and able to form a binding contract under applicable law to use
              the Services. By using the Services, you represent that you meet these requirements.
            </p>
          </Section>

          <Section title="3. Accounts">
            <p>
              You are responsible for the accuracy of your registration information, for safeguarding your
              credentials, and for all activity that occurs under your account. Notify us immediately at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: C.amber }}>
                {CONTACT_EMAIL}
              </a>{' '}
              if you suspect unauthorized use.
            </p>
          </Section>

          <Section title="4. Subscriptions, Billing, and Cancellation">
            <p>
              Paid subscriptions are billed in advance on a recurring basis through Stripe at the rates and
              intervals shown when you subscribe. By subscribing, you authorize us and Stripe to charge your
              payment method for the applicable fees.
            </p>
            <ul style={{ paddingLeft: 22, marginTop: 8 }}>
              <li>
                <strong>Plan changes.</strong> Upgrades take effect immediately and are pro-rated for the
                remainder of the current billing period. Downgrades take effect at the end of the current
                billing period unless otherwise stated.
              </li>
              <li>
                <strong>Cancellation.</strong> You may cancel at any time through the Stripe-hosted billing
                portal. Cancellation takes effect at the end of the current paid billing period; you retain
                access to paid features until that period ends.
              </li>
              <li>
                <strong>Refunds.</strong> Except where required by law, fees are non-refundable.
              </li>
              <li>
                <strong>Taxes.</strong> Stated prices do not include taxes; you are responsible for any
                applicable taxes.
              </li>
              <li>
                <strong>Failed payments.</strong> If a charge fails, we may suspend or terminate access to paid
                features until the balance is resolved.
              </li>
            </ul>
          </Section>

          <Section title="5. Not Investment Advice">
            <p>
              The Services provide options-market analytics, signals, and educational content for informational
              purposes only. Nothing on the Services constitutes investment advice, a recommendation to buy or
              sell any security or derivative, or a solicitation to enter into any transaction. ZeroGEX is not a
              registered investment adviser, broker-dealer, or financial planner. Trading options and
              derivatives involves substantial risk of loss and is not suitable for every investor. Past
              performance does not guarantee future results. You are solely responsible for your trading and
              investment decisions and should consult a qualified professional before making any.
            </p>
          </Section>

          <Section title="6. Acceptable Use">
            <p>You agree not to:</p>
            <ul style={{ paddingLeft: 22, marginTop: 8 }}>
              <li>Reverse engineer, decompile, or attempt to extract source code from the Services.</li>
              <li>
                Use the Services to build a competing product, scrape data at scale, or redistribute content
                without our written permission.
              </li>
              <li>Share or resell account credentials or paid access.</li>
              <li>Use the Services to violate any law or third-party rights.</li>
              <li>Interfere with or disrupt the Services or any servers or networks connected to them.</li>
              <li>Probe, scan, or test the vulnerability of the Services without authorization.</li>
            </ul>
          </Section>

          <Section title="7. Intellectual Property">
            <p>
              We and our licensors retain all rights, title, and interest in and to the Services, including all
              software, content, and trademarks. Subject to your compliance with these Terms, we grant you a
              limited, non-exclusive, non-transferable, revocable license to access and use the Services for
              your personal or internal business use.
            </p>
          </Section>

          <Section title="8. Third-Party Services">
            <p>
              The Services integrate with third-party providers, including Stripe for payment processing and
              Google or Apple for authentication. Your use of those services is governed by the respective
              provider&rsquo;s terms and privacy policy. We are not responsible for the availability or
              behavior of any third-party service.
            </p>
          </Section>

          <Section title="9. Disclaimers">
            <p>
              THE SERVICES ARE PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE,&rdquo; WITHOUT WARRANTIES
              OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF MERCHANTABILITY,
              FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ACCURACY. WE DO NOT WARRANT THAT THE
              SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT ANY DATA OR SIGNALS WILL BE
              ACCURATE OR PROFITABLE.
            </p>
          </Section>

          <Section title="10. Limitation of Liability">
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, ZEROGEX AND ITS AFFILIATES, OFFICERS, EMPLOYEES, AND
              AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
              DAMAGES, INCLUDING LOST PROFITS, LOST REVENUES, OR LOST DATA, ARISING OUT OF OR RELATED TO YOUR
              USE OF THE SERVICES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY FOR
              ANY CLAIM ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICES WILL NOT EXCEED THE AMOUNTS YOU
              PAID US FOR THE SERVICES IN THE TWELVE (12) MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM.
            </p>
          </Section>

          <Section title="11. Indemnification">
            <p>
              You agree to defend, indemnify, and hold harmless ZeroGEX and its affiliates from any claims,
              liabilities, damages, losses, and expenses (including reasonable attorneys&rsquo; fees) arising
              out of your use of the Services, your violation of these Terms, or your violation of any
              third-party right.
            </p>
          </Section>

          <Section title="12. Termination">
            <p>
              We may suspend or terminate your access to the Services at any time, with or without notice, for
              conduct that we reasonably believe violates these Terms or harms other users, us, or third
              parties. You may stop using the Services at any time and may cancel any active subscription as
              described in Section 4.
            </p>
          </Section>

          <Section title="13. Governing Law and Disputes">
            <p>
              These Terms are governed by the laws of the United States and the State of Delaware, without
              regard to conflict-of-laws rules. The exclusive venue for any dispute arising out of or relating
              to these Terms or the Services will be the state or federal courts located in Delaware, and you
              consent to personal jurisdiction in those courts.
            </p>
          </Section>

          <Section title="14. Changes to These Terms">
            <p>
              We may modify these Terms from time to time. If we make material changes, we will revise the
              effective date above and, where appropriate, provide additional notice through the Services. Your
              continued use of the Services after the effective date constitutes acceptance of the revised
              Terms.
            </p>
          </Section>

          <Section title="15. Contact">
            <p>
              Questions about these Terms can be sent to{' '}
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
