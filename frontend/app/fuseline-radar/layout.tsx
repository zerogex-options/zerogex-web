import type { Metadata } from 'next';

// Basic-gated and unlisted while Plus3 Forecasting and ZeroGEX shape it, so it
// stays out of the index the same way the other gated tools do.
export const metadata: Metadata = {
  title: 'Fuseline Radar | ZeroGEX',
  robots: { index: false, follow: true },
};

export default function FuselineRadarLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
