import GivingClient from './Client';
import { getGivingTotals } from '@/core/giving';
import { isPatriotPledgeOpen } from '@/core/patriotPledge';

export const metadata = {
  title: 'Giving Back — ZeroGEX Supports Folds of Honor',
  description:
    'ZeroGEX donates 3% of every subscription to Folds of Honor, providing educational scholarships to the families of fallen and disabled U.S. service members.',
  alternates: { canonical: '/giving' },
};

// The September 11 anniversary banner is time-boxed (core/patriotPledge.ts), so
// this page cannot be fully static or the banner would freeze at whatever the
// window said on the last build — still advertising a closed drive, or missing
// an open one. Revalidating every 5 minutes keeps the page cached for the SEO
// traffic it earns while letting the banner appear and expire on its own.
export const revalidate = 300;

export default function GivingPage() {
  const totals = getGivingTotals();
  // Resolved server-side: evaluating the window in the client component instead
  // would let the server and browser disagree across the boundary and hydrate
  // mismatched markup.
  return <GivingClient totals={totals} pledgeOpen={isPatriotPledgeOpen()} />;
}
