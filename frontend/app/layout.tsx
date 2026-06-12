import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/core/ThemeContext';
import { TimeframeProvider } from '@/core/TimeframeContext';
import ClientLayout from '@/components/ClientLayout';

const dmSans = DM_Sans({ 
  subsets: ['latin'],
  weight: ['400', '500', '700']
});

// Shared site-wide description, sized for both Google SERP snippets and
// LinkedIn/X social cards (LinkedIn warns under 100 chars; Google truncates
// around 160). 138 characters lands cleanly inside both windows.
const SITE_DESCRIPTION = 'Real-time gamma exposure, dealer positioning, gamma walls, and live options flow for SPX/0DTE traders. Free dashboard, no signup required.';

export const metadata: Metadata = {
  title: 'ZeroGEX™ | Real-Time Options Analytics',
  description: SITE_DESCRIPTION,
  icons: {
    icon: '/favicon.ico',
  },
  metadataBase: new URL('https://zerogex.io'),
  // OG and Twitter images are auto-attached from app/opengraph-image.tsx
  // (the Next.js file convention), so each route inherits the dynamic
  // 1200×630 image rendered by next/og — including pages that don't have
  // their own per-route opengraph-image.tsx. The three routes that DO
  // (pillar, comparison, 0DTE landing) override per-route via the same
  // file convention.
  openGraph: {
    title: 'ZeroGEX™ | Real-Time Options Analytics',
    description: SITE_DESCRIPTION,
    url: 'https://zerogex.io',
    siteName: 'ZeroGEX',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ZeroGEX™ | Real-Time Options Analytics',
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body 
        className={dmSans.className}
        style={{ 
          margin: 0,
          padding: 0
        }}
      >
        <ThemeProvider>
          <TimeframeProvider>
            <ClientLayout>
              {children}
            </ClientLayout>
          </TimeframeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
