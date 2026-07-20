import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import {
  Archivo,
  Chakra_Petch,
  Cormorant_Garamond,
  DM_Serif_Display,
  Fraunces,
  Inter,
  JetBrains_Mono,
  Libre_Baskerville,
  Newsreader,
  Noto_Sans,
  Outfit,
  Playfair_Display,
  Poppins,
  Prata,
  Space_Grotesk,
} from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/core/ThemeContext';
import { LanguageProvider } from '@/core/LanguageContext';
import { normalizeLocale, type Locale } from '@/core/i18n/locales';
import { getRequestLocale } from '@/core/localizedMetadata';
import { TimeframeProvider } from '@/core/TimeframeContext';
import { GexUnitProvider } from '@/core/GexUnitContext';
import { DensityProvider } from '@/core/DensityContext';
import ClientLayout from '@/components/ClientLayout';
import TelemetryProvider from '@/components/TelemetryProvider';
import PageAnalytics from '@/components/PageAnalytics';
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

// Miami Beach — display sans, wide geometric 80s marquee.
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800', '900'],
  variable: '--font-poppins',
  display: 'swap',
});

// London Fog — English editorial serif, foggy and financial.
const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-newsreader',
  display: 'swap',
});

// Monaco Riviera — high-fashion didone serif, Riviera glamour.
const prata = Prata({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-prata',
  display: 'swap',
});

// Zürich Vault — Swiss grotesque, precise and quiet.
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-archivo',
  display: 'swap',
});

// Amalfi Lemon — elegant Italian display serif.
const dmSerifDisplay = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-dm-serif',
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

const FONT_VARIABLES = [
  inter.variable,
  jetbrainsMono.variable,
  spaceGrotesk.variable,
  libreBaskerville.variable,
  playfair.variable,
  cormorant.variable,
  notoSans.variable,
  poppins.variable,
  newsreader.variable,
  prata.variable,
  archivo.variable,
  dmSerifDisplay.variable,
  outfit.variable,
  fraunces.variable,
  chakraPetch.variable,
].join(' ');

type PaletteId = 'zerogex-og' | 'mars' | 'california' | 'wallstreet' | 'kyoto' | 'miami' | 'london' | 'monaco' | 'zurich' | 'amalfi' | 'maldives' | 'tulum';
const PALETTES: PaletteId[] = ['zerogex-og', 'mars', 'california', 'wallstreet', 'kyoto', 'miami', 'london', 'monaco', 'zurich', 'amalfi', 'maldives', 'tulum'];
const DEFAULT_PALETTE: PaletteId = 'zerogex-og';
const LEGACY_PALETTE_MAP: Record<string, PaletteId> = {
  walnut: 'kyoto',
  pacific: 'miami',
  deluxe: 'wallstreet',
};

// Shared site-wide description, sized for both Google SERP snippets and
// LinkedIn/X social cards (LinkedIn warns under 100 chars; Google truncates
// around 160). 138 characters lands cleanly inside both windows.
const SITE_DESCRIPTION = 'Real-time gamma exposure, dealer positioning, gamma walls, and live options flow for SPX/0DTE traders. Free 15-min-delayed gamma levels, no signup required.';

// Site-wide title + description per locale. ZeroGEX and the options-trading
// terms (gamma exposure, dealer positioning, gamma walls, options flow, GEX,
// 0DTE) and tickers (SPX) stay in English; the sentence around them is
// translated. This is the default/fallback metadata for every route.
const SITE_META: Record<Locale, { title: string; description: string; ogLocale: string }> = {
  en: {
    title: 'ZeroGEX™ | Real-Time Options Analytics',
    description: SITE_DESCRIPTION,
    ogLocale: 'en_US',
  },
  it: {
    title: 'ZeroGEX™ | Analisi delle opzioni in tempo reale',
    description:
      'Gamma exposure in tempo reale, posizionamento dei dealer, gamma walls e options flow live per i trader SPX/0DTE. Livelli gamma gratuiti con ritardo di 15 minuti, senza registrazione.',
    ogLocale: 'it_IT',
  },
  de: {
    title: 'ZeroGEX™ | Optionsanalyse in Echtzeit',
    description:
      'Echtzeit-Gamma-Exposure, Dealer-Positionierung, Gamma-Walls und Live-Options-Flow für SPX/0DTE-Trader. Kostenlose, 15 Minuten verzögerte Gamma-Level — ohne Anmeldung.',
    ogLocale: 'de_DE',
  },
  es: {
    title: 'ZeroGEX™ | Análisis de opciones en tiempo real',
    description:
      'Gamma exposure en tiempo real, posicionamiento de dealers, gamma walls y options flow en vivo para traders de SPX/0DTE. Niveles gamma gratuitos con retraso de 15 minutos, sin registro.',
    ogLocale: 'es_ES',
  },
  fr: {
    title: 'ZeroGEX™ | Analyse d’options en temps réel',
    description:
      'Gamma exposure en temps réel, positionnement des dealers, gamma walls et options flow en direct pour les traders SPX/0DTE. Niveaux gamma gratuits différés de 15 min, sans inscription.',
    ogLocale: 'fr_FR',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const m = SITE_META[locale] ?? SITE_META.en;
  return {
    title: m.title,
    description: m.description,
    icons: {
      icon: '/favicon.ico',
    },
    metadataBase: new URL('https://zerogex.io'),
    openGraph: {
      title: m.title,
      description: m.description,
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
      locale: m.ogLocale,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: m.title,
      description: m.description,
      images: ['/og-image.png'],
    },
  };
}

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
