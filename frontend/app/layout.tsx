import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import {
  Cormorant_Garamond,
  Inter,
  JetBrains_Mono,
  Libre_Baskerville,
  Noto_Sans,
  Playfair_Display,
  Poppins,
} from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/core/ThemeContext';
import { TimeframeProvider } from '@/core/TimeframeContext';
import { GexUnitProvider } from '@/core/GexUnitContext';
import ClientLayout from '@/components/ClientLayout';
import TelemetryProvider from '@/components/TelemetryProvider';
import TwitterPixelProvider from '@/components/TwitterPixelProvider';

// Site body sans — Inter is the shared body font across every palette.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

// Shared mono — data, labels, code, ticker rows, tabular numerals.
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

// Wall Street — editorial serif, tailored, ivory-and-navy.
const libreBaskerville = Libre_Baskerville({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-libre-baskerville',
  display: 'swap',
});

// California Sunset — display serif, Hollywood editorial.
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-playfair',
  display: 'swap',
});

// Kyoto Zen — display serif, calm classical elegance.
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-cormorant',
  display: 'swap',
});

// Kyoto Zen — body sans, humanist and humble.
const notoSans = Noto_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-sans',
  display: 'swap',
});

// Miami Beach — display sans, wide geometric 80s marquee.
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800', '900'],
  variable: '--font-poppins',
  display: 'swap',
});

const FONT_VARIABLES = [
  inter.variable,
  jetbrainsMono.variable,
  libreBaskerville.variable,
  playfair.variable,
  cormorant.variable,
  notoSans.variable,
  poppins.variable,
].join(' ');

type PaletteId = 'california' | 'wallstreet' | 'kyoto' | 'miami';
const PALETTES: PaletteId[] = ['california', 'wallstreet', 'kyoto', 'miami'];
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
              <TwitterPixelProvider />
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
