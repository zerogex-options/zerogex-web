'use client';

// Ambassador Program Terms — shared presentational content, rendered both in the
// onboarding acceptance flow (/account/ambassador) and on the public
// /ambassador-terms page. The numeric terms are props so the copy reflects the
// reader's ACTUAL configured terms where known, defaulting to the program
// defaults otherwise.
//
// NOTE: This is a working product implementation of the program terms and should
// receive legal review before any broader launch.

export type AmbassadorTermsProps = {
  version?: string | null;
  commissionPct?: number;
  creditPct?: number;
  commissionDurationMonths?: number;
  holdingPeriodDays?: number;
  attributionWindowDays?: number;
};

const C = {
  text: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
  border: 'var(--color-border)',
  amber: 'var(--color-brand-primary)',
  surface: 'var(--color-surface)',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 20 }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: C.text }}>{title}</h3>
      <div style={{ fontSize: 13.5, lineHeight: 1.6, color: C.muted }}>{children}</div>
    </section>
  );
}

export default function AmbassadorTerms({
  version = 'v1',
  commissionPct = 20,
  creditPct = 25,
  commissionDurationMonths = 12,
  holdingPeriodDays = 30,
  attributionWindowDays = 60,
}: AmbassadorTermsProps) {
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          color: C.muted,
          border: `1px dashed ${C.border}`,
          borderRadius: 10,
          padding: '10px 12px',
          background: 'var(--bg-active)',
        }}
      >
        Working product implementation of the ZeroGEX Ambassador Program Terms
        {version ? ` (${version})` : ''}. This document should receive legal review before broader
        launch. By accepting, you agree to the terms below.
      </div>

      <Section title="Invite-only participation">
        The Ambassador Program is invite-only. Participation begins only when ZeroGEX invites you and
        you accept these terms. There is no public application at this stage.
      </Section>

      <Section title="Eligibility — no follower minimum">
        Ambassadors are selected for genuine product enthusiasm, credibility, product knowledge, and
        willingness to recommend ZeroGEX — <strong>not</strong> follower count. There is no minimum
        audience or follower requirement.
      </Section>

      <Section title="No guaranteed earnings">
        Nothing here guarantees any earnings. Rewards depend entirely on referred customers choosing
        to subscribe and successfully paying, and are subject to the conditions below.
      </Section>

      <Section title="Eligible and ineligible revenue">
        Rewards are earned only on <strong>successfully collected subscription revenue</strong> from
        customers you refer. No reward is earned on free trials, failed or unpaid invoices, refunded
        amounts, chargebacks or disputes, taxes, promotional credits, gift balances, or any amount not
        actually collected. You never earn on your own subscription.
      </Section>

      <Section title="Attribution rules">
        A referral is attributed when a new customer registers through your unique link or code within
        the {attributionWindowDays}-day attribution window of their first click. The first valid
        attribution wins — a later code cannot override an existing attribution. Self-referrals are not
        permitted.
      </Section>

      <Section title="Rewards & commission duration">
        You choose one reward method: <strong>{commissionPct}% cash commission</strong> or{' '}
        <strong>{creditPct}% ZeroGEX account credit</strong>, on eligible collected subscription
        revenue. Commission applies for the referred customer&rsquo;s first {commissionDurationMonths}{' '}
        months. Changing your reward preference applies to future commissions only and never alters
        rewards you have already earned.
      </Section>

      <Section title="Holding period">
        Each reward is held for {holdingPeriodDays} days before it becomes payable (cash) or is applied
        as account credit. This protects against refunds and disputes that occur shortly after payment.
      </Section>

      <Section title="Refund & dispute reversals">
        If a referred payment is later refunded, the related reward is reversed proportionally. A full
        refund, chargeback, or dispute reverses the full related reward. Where a reward was already
        issued, a compensating adjustment is recorded rather than deleting history.
      </Section>

      <Section title="Prohibited conduct">
        The following will result in reversal of affected rewards and may end your participation: spam;
        misleading or unsupported performance claims; impersonating ZeroGEX or its team; trademark
        abuse; bidding on ZeroGEX-protected terms in paid search; coupon or incentive abuse;
        self-referrals; and offering unauthorized incentives to sign up.
      </Section>

      <Section title="Required affiliate disclosures">
        You must make clear and conspicuous affiliate disclosures whenever you promote ZeroGEX in
        exchange for commissions, credits, free access, or other benefits — for example: &ldquo;I&rsquo;m a
        ZeroGEX affiliate and may earn a commission if you subscribe through my link.&rdquo;
      </Section>

      <Section title="Program changes, pausing & termination">
        ZeroGEX may pause or terminate your participation at any time, and may update these terms
        prospectively. Valid rewards you have already earned are preserved, subject to refunds,
        disputes, fraud, and violations of these terms.
      </Section>

      <Section title="Relationship of the parties">
        Ambassadors are independent participants. This program does not create any employment, agency,
        partnership, or investment-advisory relationship. Ambassadors are not employees, agents,
        investment advisers, financial professionals, or official representatives of ZeroGEX, and must
        not describe themselves as such.
      </Section>

      <Section title="Versioned acceptance">
        Your acceptance of these terms is recorded with the terms version in force at that time. If the
        terms are updated, we may ask you to review and accept the new version.
      </Section>
    </div>
  );
}
