import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import {
  DM_Sans,
  DM_Serif_Display,
  EB_Garamond,
  Fraunces,
  Inter,
  JetBrains_Mono,
  Manrope,
  Space_Grotesk,
  Syne,
} from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/core/ThemeContext';
import { TimeframeProvider } from '@/core/TimeframeContext';
import { GexUnitProvider } from '@/core/GexUnitContext';
import ClientLayout from '@/components/ClientLayout';
import TelemetryProvider from '@/components/TelemetryProvider';

// California Sunset — body sans.
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

// Miami Beach body, plus legacy fallback for the site-wide body font var.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

// Shared mono — data, labels, code, ticker rows, tabular numerals.
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

// California Sunset — display serif, warm & modern.
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-fraunces',
  display: 'swap',
});

// Kyoto Zen — display serif, calm & classical.
const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-eb-garamond',
  display: 'swap',
});

// Kyoto Zen — body sans, quiet and humble.
const manrope = Manrope({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
});

// Miami Beach — display, geometric 80s.
const syne = Syne({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-syne',
  display: 'swap',
});

// Wall Street — display serif, editorial gravitas.
const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-dm-serif',
  display: 'swap',
});

// Wall Street — body sans.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const FONT_VARIABLES = [
  dmSans.variable,
  spaceGrotesk.variable,
  jetbrainsMono.variable,
  fraunces.variable,
  ebGaramond.variable,
  manrope.variable,
  syne.variable,
  dmSerif.variable,
  inter.variable,
].join(' ');

type PaletteId = 'california' | 'kyoto' | 'miami' | 'wallstreet';
const PALETTES: PaletteId[] = ['california', 'kyoto', 'miami', 'wallstreet'];
const DEFAULT_PALETTE: PaletteId = 'california';
const LEGACY_PALETTE_MAP: Record<string, PaletteId> = {
  walnut: 'kyoto',
  pacific: 'miami',
  deluxe: 'wallstreet',
};

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
  openGraph: {
    title: 'ZeroGEX™ | Real-Time Options Analytics',
    description: SITE_DESCRIPTION,
    url: 'https://zerogex.io',
    siteName: 'ZeroGEX',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ZeroGEX Options Analytics Platform',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ZeroGEX™ | Real-Time Options Analytics',
    description: SITE_DESCRIPTION,
    images: ['/og-image.png'],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read persisted palette/theme from cookies so the initial HTML paints in
  // the user's chosen palette. Prevents a flash of default styling when the
  // client hydrates.
  const cookieStore = await cookies();
  const rawPalette = cookieStore.get('palette')?.value;
  const mappedPalette = rawPalette && LEGACY_PALETTE_MAP[rawPalette] ? LEGACY_PALETTE_MAP[rawPalette] : rawPalette;
  const palette: PaletteId = PALETTES.includes(mappedPalette as PaletteId)
    ? (mappedPalette as PaletteId)
    : DEFAULT_PALETTE;
  const theme = cookieStore.get('theme')?.value === 'light' ? 'light' : 'dark';

  const htmlClass = `${FONT_VARIABLES} palette-${palette}${theme === 'dark' ? ' dark' : ''}`;

  return (
    <html lang="en" className={htmlClass}>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        <ThemeProvider>
          <TimeframeProvider>
            <GexUnitProvider>
              <TelemetryProvider />
              <ClientLayout>
                {children}
              </ClientLayout>
            </GexUnitProvider>
          </TimeframeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
