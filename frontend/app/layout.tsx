import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { UI_COOKIE, flagFromCookie, navWidthFor } from '@/core/uiCookies';
import {
  APPEARANCE_PENDING_COOKIE,
  PALETTE_COOKIE,
  THEME_COOKIE,
  resolveAppearance,
} from '@/core/appearance';
import { readAppearanceForCurrentSession } from '@/core/serverAuth';
import localFont from 'next/font/local';
import './globals.css';
import { ThemeProvider } from '@/core/ThemeContext';
import { LanguageProvider } from '@/core/LanguageContext';
import { normalizeLocale } from '@/core/i18n/locales';
import { TimeframeProvider } from '@/core/TimeframeContext';
import { GexUnitProvider } from '@/core/GexUnitContext';
import { StrikeFilterProvider } from '@/core/StrikeFilterContext';
import { SessionDeltaProvider } from '@/core/SessionDeltaContext';
import { DensityProvider } from '@/core/DensityContext';
import ClientLayout from '@/components/ClientLayout';
import TelemetryProvider from '@/components/TelemetryProvider';
import PageAnalytics from '@/components/PageAnalytics';
import TwitterPixelProvider from '@/components/TwitterPixelProvider';
import SiteJsonLd from '@/components/SiteJsonLd';
import { OG_IMAGE_PATH, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from '@/core/ogImageManifest';

// Only the three faces the default "ZeroGEX OG" palette paints with (Inter,
// JetBrains Mono, Space Grotesk) are preloaded. next/font/local preloads every
// declared file by default, and with eighteen families declared here that put
// ~690KB of <link rel="preload" as="font"> on every page — fifteen of them for
// palettes the visitor has not chosen, fetched at high priority ahead of the
// page's own content. The other faces keep their @font-face declarations, so
// a saved palette still loads its fonts on demand; they just no longer tax
// the first paint of every organic landing. (Core Web Vitals feed ranking,
// and mobile is where the free levels pages earn their best CTR.)
// Site body sans — Inter is the shared body font across every palette.
const inter = localFont({
  src: [{ path: './fonts/inter/inter-variable.woff2', weight: '400 700', style: 'normal' }],
  variable: '--font-inter',
  display: 'swap',
});

// Shared mono — data, labels, code, ticker rows, tabular numerals.
const jetbrainsMono = localFont({
  src: [{ path: './fonts/jetbrains-mono/jetbrains-mono-variable.woff2', weight: '400 700', style: 'normal' }],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

// ZeroGEX OG — the house grotesque. The face on the brand business card;
// used for both display and body in the flagship "ZeroGEX OG" palette.
const spaceGrotesk = localFont({
  src: [{ path: './fonts/space-grotesk/space-grotesk-variable.woff2', weight: '400 700', style: 'normal' }],
  variable: '--font-space-grotesk',
  display: 'swap',
});

// Wall Street — editorial serif, tailored, ivory-and-navy.
const libreBaskerville = localFont({
  src: [{ path: './fonts/libre-baskerville/libre-baskerville-variable.woff2', weight: '400 700', style: 'normal' }],
  variable: '--font-libre-baskerville',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
});

// California Sunset — display serif, Hollywood editorial.
const playfair = localFont({
  src: [{ path: './fonts/playfair/playfair-variable.woff2', weight: '400 800', style: 'normal' }],
  variable: '--font-playfair',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
});

// Kyoto Zen — display serif, calm classical elegance.
const cormorant = localFont({
  src: [{ path: './fonts/cormorant/cormorant-variable.woff2', weight: '300 700', style: 'normal' }],
  variable: '--font-cormorant',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
});

// Kyoto Zen — body sans, humanist and humble.
const notoSans = localFont({
  src: [{ path: './fonts/noto-sans/noto-sans-variable.woff2', weight: '400 700', style: 'normal' }],
  variable: '--font-noto-sans',
  display: 'swap',
  preload: false,
});

// London Fog — English editorial serif, foggy and financial.
const newsreader = localFont({
  src: [{ path: './fonts/newsreader/newsreader-variable.woff2', weight: '400 600', style: 'normal' }],
  variable: '--font-newsreader',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
});

// Zürich Vault — Swiss grotesque, precise and quiet.
const archivo = localFont({
  src: [{ path: './fonts/archivo/archivo-variable.woff2', weight: '400 700', style: 'normal' }],
  variable: '--font-archivo',
  display: 'swap',
  preload: false,
});

// Maldives Lagoon — airy geometric sans, resort-modern.
const outfit = localFont({
  src: [{ path: './fonts/outfit/outfit-variable.woff2', weight: '400 700', style: 'normal' }],
  variable: '--font-outfit',
  display: 'swap',
  preload: false,
});

// Tulum Jungle — soft organic serif, boho-editorial.
const fraunces = localFont({
  src: [{ path: './fonts/fraunces/fraunces-variable.woff2', weight: '400 700', style: 'normal' }],
  variable: '--font-fraunces',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
});

// Mars · Olympus — technical instrument-panel sans, planetary telemetry.
const chakraPetch = localFont({
  src: [
    { path: './fonts/chakra-petch/chakra-petch-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/chakra-petch/chakra-petch-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/chakra-petch/chakra-petch-600.woff2', weight: '600', style: 'normal' },
    { path: './fonts/chakra-petch/chakra-petch-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-chakra-petch',
  display: 'swap',
  preload: false,
});

// Vinyl Topanga — chunky rounded 70s display (Cooper-Black lineage). Ships a
// single 400 weight, so Vinyl's headings are pinned to 400 in globals.css to
// avoid a synthesized faux-bold on this already-heavy face.
const bagelFatOne = localFont({
  src: [{ path: './fonts/bagel-fat-one/bagel-fat-one-variable.woff2', weight: '400', style: 'normal' }],
  variable: '--font-bagel-fat-one',
  display: 'swap',
  preload: false,
});

// Vinyl Topanga — warm rounded body sans.
const rubik = localFont({
  src: [{ path: './fonts/rubik/rubik-variable.woff2', weight: '400 700', style: 'normal' }],
  variable: '--font-rubik',
  display: 'swap',
  preload: false,
});

// Monochrome Madison — Futura-style geometric display, mid-century modernist.
const jost = localFont({
  src: [{ path: './fonts/jost/jost-variable.woff2', weight: '400 700', style: 'normal' }],
  variable: '--font-jost',
  display: 'swap',
  preload: false,
});

// Monochrome Madison — serious editorial reading serif.
const spectral = localFont({
  src: [
    { path: './fonts/spectral/spectral-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/spectral/spectral-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/spectral/spectral-600.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-spectral',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
});

// Palm Springs — warm boutique serif display.
const gloock = localFont({
  src: [{ path: './fonts/gloock/gloock-variable.woff2', weight: '400', style: 'normal' }],
  variable: '--font-gloock',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
});

// Palm Springs — clean modern body sans.
const hankenGrotesk = localFont({
  src: [{ path: './fonts/hanken-grotesk/hanken-grotesk-variable.woff2', weight: '400 700', style: 'normal' }],
  variable: '--font-hanken-grotesk',
  display: 'swap',
  preload: false,
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

// Shared site-wide description, sized for both Google SERP snippets and
// LinkedIn/X social cards (LinkedIn warns under 100 chars; Google truncates
// around 160). 138 characters lands cleanly inside both windows.
const SITE_DESCRIPTION = 'Real-time gamma exposure, dealer positioning, gamma walls, and live options flow for SPX/0DTE traders. Free 15-min-delayed gamma levels, no signup required.';

export const metadata: Metadata = {
  title: 'ZeroGEX™ | Real-Time Gamma Exposure (GEX) & Options Analytics',
  description: SITE_DESCRIPTION,
  // No `icons` entry on purpose. app/favicon.ico is an App Router metadata
  // file, so Next emits the <link rel="icon"> itself with a content hash in the
  // URL (/favicon.ico?favicon.<hash>.ico). Spelling out `icons: { icon:
  // '/favicon.ico' }` here adds a second, un-hashed tag that browsers can
  // prefer -- and an un-hashed URL never changes, so a re-exported favicon
  // keeps resolving to whatever the browser already cached.
  metadataBase: new URL('https://zerogex.io'),
  openGraph: {
    title: 'ZeroGEX™ | Real-Time Gamma Exposure (GEX) & Options Analytics',
    description: SITE_DESCRIPTION,
    url: 'https://zerogex.io',
    siteName: 'ZeroGEX',
    images: [
      {
        url: OG_IMAGE_PATH,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        alt: 'ZeroGEX Options Analytics Platform',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ZeroGEX™ | Real-Time Gamma Exposure (GEX) & Options Analytics',
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE_PATH],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Paint the member's chosen palette/theme in the initial HTML, so there is
  // no flash of default styling when the client hydrates. The cookies say what
  // this browser last used; for a signed-in member the account copy wins, so a
  // browser that dropped the cookies still paints their own look (see
  // resolveAppearance for the rules).
  const cookieStore = await cookies();
  const appearance = resolveAppearance({
    cookieTheme: cookieStore.get(THEME_COOKIE)?.value,
    cookiePalette: cookieStore.get(PALETTE_COOKIE)?.value,
    pending: cookieStore.get(APPEARANCE_PENDING_COOKIE)?.value === '1',
    account: await readAppearanceForCurrentSession(),
  });
  const { palette, theme } = appearance;

  // Persisted UI language — seeds both <html lang> (for a11y/SEO and correct
  // initial paint) and the LanguageProvider so SSR and the first client render
  // agree. Defaults to English when the cookie is absent.
  const locale = normalizeLocale(cookieStore.get('lang')?.value);

  // Chrome collapse state, for the same reason as the palette above: these
  // decide what MARKUP the header and sidebar render, not just how it is
  // painted, so the server has to know them or it emits the wrong chrome and
  // the page rearranges itself once the client reads storage. Stamping
  // --zgx-nav-width here is what stops page content rendering underneath the
  // sidebar on the first paint — <main> reserves its gutter from this var, and
  // Navigation only assigns it from an effect.
  const headerCollapsed = flagFromCookie(cookieStore.get(UI_COOKIE.headerCollapsed)?.value, false);
  const sidebarVisible = flagFromCookie(cookieStore.get(UI_COOKIE.sidebarVisible)?.value, true);

  const htmlClass = `${FONT_VARIABLES} palette-${palette}${theme === 'dark' ? ' dark' : ''}`;

  return (
    <html
      lang={locale}
      className={htmlClass}
      style={{ ['--zgx-nav-width' as string]: `${navWidthFor(sidebarVisible)}px` }}
    >
      <head>
        {/* Site-wide Organization + WebSite structured data (brand entity). */}
        <SiteJsonLd />
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        <ThemeProvider
          initialTheme={theme}
          initialPalette={palette}
          fromAccount={appearance.fromAccount}
          syncToAccount={appearance.syncToAccount}
        >
          <LanguageProvider initialLocale={locale}>
            <TimeframeProvider>
              <GexUnitProvider>
                <StrikeFilterProvider>
                  <SessionDeltaProvider>
                    <DensityProvider>
                      <TelemetryProvider />
                      <TwitterPixelProvider />
                      <PageAnalytics />
                      <ClientLayout
                        initialHeaderCollapsed={headerCollapsed}
                        initialSidebarVisible={sidebarVisible}
                      >
                        {children}
                      </ClientLayout>
                    </DensityProvider>
                  </SessionDeltaProvider>
                </StrikeFilterProvider>
              </GexUnitProvider>
            </TimeframeProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
