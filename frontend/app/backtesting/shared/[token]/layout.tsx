import type { Metadata } from 'next';

// The shared report page is a client component, so its metadata lives here.
// Every token is a public URL to one member's run: it gets its own title
// instead of the homepage's, and noindex so a growing set of near-identical
// report shells never competes with the site's own pages. follow stays on so
// the links back into the site still count.
export const metadata: Metadata = {
  title: 'Shared Backtest Report\u00a0- ZeroGEX',
  description:
    'A shared ZeroGEX backtest result: net-of-cost return, equity curve and Monte Carlo spread for one strategy run.',
  robots: { index: false, follow: true },
};

export default function SharedBacktestLayout({ children }: { children: React.ReactNode }) {
  return children;
}
