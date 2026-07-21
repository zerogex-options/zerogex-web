import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import {
  Archivo,
  Bagel_Fat_One,
  Chakra_Petch,
  Cormorant_Garamond,
  Fraunces,
  Gloock,
  Hanken_Grotesk,
  Inter,
  JetBrains_Mono,
  Jost,
  Libre_Baskerville,
  Newsreader,
  Noto_Sans,
  Outfit,
  Playfair_Display,
  Rubik,
  Space_Grotesk,
  Spectral,
} from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/core/ThemeContext';
import { LanguageProvider } from '@/core/LanguageContext';
import { normalizeLocale } from '@/core/i18n/locales';
import { TimeframeProvider } from '@/core/TimeframeContext';
import { GexUnitProvider } from '@/core/GexUnitContext';
import { DensityProvider } from '@/core/DensityContext';
import ClientLayout from '@/components/ClientLayout';
import TelemetryProvider from '@/components/TelemetryProvider';
import PageAnalytics from '@/components/PageAnalytics';
import TwitterPixelProvider from '@/components/TwitterPixelProvider';
import SiteJsonLd from '@/components/SiteJsonLd';

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

// ZeroGEX OG — the house grotesque. The face on the brand business card;
// used for both display and body in the flagship "ZeroGEX OG" palette.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
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

// London Fog — English editorial serif, foggy and financial.
const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-newsreader',
  display: 'swap',
});

// Zürich Vault — Swiss grotesque, precise and quiet.
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-archivo',
  display: 'swap',
});

// Maldives Lagoon — airy geometric sans, resort-modern.
const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-outfit',
  display: 'swap',
});

// Tulum Jungle — soft organic serif, boho-editorial.
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-fraunces',
  display: 'swap',
});

// Mars · Olympus — technical instrument-panel sans, planetary telemetry.
const chakraPetch = Chakra_Petch({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-chakra-petch',
  display: 'swap',
});

// Vinyl Topanga — chunky rounded 70s display (Cooper-Black lineage). Ships a
// single 400 weight, so Vinyl's headings are pinned to 400 in globals.css to
// avoid a synthesized faux-bold on this already-heavy face.
const bagelFatOne = Bagel_Fat_One({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-bagel-fat-one',
  display: 'swap',
});

// Vinyl Topanga — warm rounded body sans.
const rubik = Rubik({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-rubik',
  display: 'swap',
});

// Monochrome Madison — Futura-style geometric display, mid-century modernist.
const jost = Jost({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jost',
  display: 'swap',
});

// Monochrome Madison — serious editorial reading serif.
const spectral = Spectral({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-spectral',
  display: 'swap',
});

// Palm Springs — warm boutique serif display.
const gloock = Gloock({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-gloock',
  display: 'swap',
});

// Palm Springs — clean modern body sans.
const hankenGrotesk = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-hanken-grotesk',
  display: 'swap',
});

const FONT_VARIABLES = [
  inter.variable,
  jetbrainsMono.variable,
  spaceGrotesk.variable,
  libreBaskerville.variable,
  playfair.variable,
  cormorant.variable,
  notoSans.variable,
  newsreader.variable,
  archivo.variable,
  outfit.variable,
  fraunces.variable,
  chakraPetch.variable,
  bagelFatOne.variable,
  rubik.variable,
  jost.variable,
  spectral.variable,
  gloock.variable,
  hankenGrotesk.variable,
].join(' ');

type PaletteId = 'zerogex-og' | 'mars' | 'california' | 'wallstreet' | 'kyoto' | 'london' | 'zurich' | 'maldives' | 'tulum' | 'vinyl-topanga' | 'monochrome-madison' | 'palm-springs';
const PALETTES: PaletteId[] = ['zerogex-og', 'mars', 'california', 'wallstreet', 'kyoto', 'london', 'zurich', 'maldives', 'tulum', 'vinyl-topanga', 'monochrome-madison', 'palm-springs'];
const DEFAULT_PALETTE: PaletteId = 'zerogex-og';
// Retired palettes migrate to their nearest successor so a saved preference
// never resolves to nothing (walnut/pacific/deluxe were earlier renames).
const LEGACY_PALETTE_MAP: Record<string, PaletteId> = {
  walnut: 'kyoto',
  deluxe: 'wallstreet',
  pacific: 'palm-springs',
  miami: 'palm-springs',
  monaco: 'monochrome-madison',
  amalfi: 'palm-springs',
};

// Shared site-wide description, sized for both Google SERP snippets and
// LinkedIn/X social cards (LinkedIn warns under 100 chars; Google truncates
// around 160). 138 characters lands cleanly inside both windows.
const SITE_DESCRIPTION = 'Real-time gamma exposure, dealer positioning, gamma walls, and live options flow for SPX/0DTE traders. Free 15-min-delayed gamma levels, no signup required.';

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

  // Persisted UI language — seeds both <html lang> (for a11y/SEO and correct
  // initial paint) and the LanguageProvider so SSR and the first client render
  // agree. Defaults to English when the cookie is absent.
  const locale = normalizeLocale(cookieStore.get('lang')?.value);

  const htmlClass = `${FONT_VARIABLES} palette-${palette}${theme === 'dark' ? ' dark' : ''}`;

  return (
    <html lang={locale} className={htmlClass}>
      <head>
        <link rel="icon" href="/favicon.ico" />
        {/* Site-wide Organization + WebSite structured data (brand entity). */}
        <SiteJsonLd />
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        <ThemeProvider>
          <LanguageProvider initialLocale={locale}>
            <TimeframeProvider>
              <GexUnitProvider>
                <DensityProvider>
                  <TelemetryProvider />
                  <TwitterPixelProvider />
                  <PageAnalytics />
                  <ClientLayout>
                    {children}
                  </ClientLayout>
                </DensityProvider>
              </GexUnitProvider>
            </TimeframeProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
