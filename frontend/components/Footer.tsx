'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Mail, Youtube } from 'lucide-react';
import { Theme } from '@/core/types';
import { brandLogo } from '@/core/brand';
import { useLanguage } from '@/core/LanguageContext';
import type { TranslationKey } from '@/core/i18n';

interface FooterProps {
  theme: Theme;
}

type FooterLink = { href: string; labelKey: TranslationKey; external?: boolean };
type FooterColumn = { headingKey: TranslationKey; links: FooterLink[] };

// Four semantic columns instead of one flat list of nine links under a generic
// "Navigation" head. Grouping is the whole point: a visitor scanning for the
// API docs, the risk disclaimer, and the education hub should find each in the
// column they'd expect it in on any other platform, without reading all nine.
const FOOTER_COLUMNS: FooterColumn[] = [
  {
    headingKey: 'footer.platform',
    links: [
      { href: '/dashboard', labelKey: 'footer.platform' },
      { href: '/spx-gamma-levels', labelKey: 'footer.freeGammaLevels' },
      { href: '/pricing', labelKey: 'footer.pricing' },
      { href: 'https://api.zerogex.io/docs', labelKey: 'footer.apiDocs', external: true },
    ],
  },
  {
    headingKey: 'nav.group.education',
    links: [
      { href: '/education', labelKey: 'nav.hub' },
      { href: '/guides', labelKey: 'nav.guides' },
      { href: '/help/platform', labelKey: 'nav.platformGuide' },
      { href: '/help/faqs', labelKey: 'footer.faqs' },
    ],
  },
  {
    headingKey: 'footer.col.company',
    links: [
      { href: '/about', labelKey: 'nav.about' },
      { href: '/updates', labelKey: 'footer.updates' },
      { href: '/giving', labelKey: 'footer.givingBack' },
    ],
  },
  {
    headingKey: 'footer.col.legal',
    links: [
      { href: '/privacy', labelKey: 'footer.privacy' },
      { href: '/terms', labelKey: 'footer.terms' },
    ],
  },
];

const VETERANS_BADGE_TEXT = '3% of every subscription supports U.S. military families via Folds of Honor.';

const TWITTER_HANDLE = '@ZeroGEXOptions';
const TWITTER_URL = `https://x.com/${TWITTER_HANDLE}`;
const YOUTUBE_HANDLE = '@ZeroGEX';
const YOUTUBE_URL = `https://www.youtube.com/${YOUTUBE_HANDLE}`;
const REDDIT_HANDLE = 'u/LopsidedComparison26';
const REDDIT_URL = `https://www.reddit.com/user/LopsidedComparison26`;
const CONTACT_EMAIL = 'support@zerogex.io';

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function RedditIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
    </svg>
  );
}

// Ghost icon buttons. These used to be solid brand-colored circles with drop
// shadows and a translateY lift on hover — the single most dated element on the
// page, and the only place on the site using a filled circular control.
function SocialLinks() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <a
        href={TWITTER_URL}
        target="_blank"
        rel="noreferrer"
        aria-label={`ZeroGEX on X (${TWITTER_HANDLE})`}
        title={TWITTER_HANDLE}
        className="zg-social"
      >
        <XIcon size={15} />
      </a>
      <a
        href={YOUTUBE_URL}
        target="_blank"
        rel="noreferrer"
        aria-label={`ZeroGEX on YouTube (${YOUTUBE_HANDLE})`}
        title={YOUTUBE_HANDLE}
        className="zg-social"
      >
        <Youtube size={16} strokeWidth={2} />
      </a>
      <a
        href={REDDIT_URL}
        target="_blank"
        rel="noreferrer"
        aria-label={`ZeroGEX on Reddit (${REDDIT_HANDLE})`}
        title={REDDIT_HANDLE}
        className="zg-social"
      >
        <RedditIcon size={15} />
      </a>
      <a
        href={`mailto:${CONTACT_EMAIL}`}
        aria-label={`Email ZeroGEX at ${CONTACT_EMAIL}`}
        title={CONTACT_EMAIL}
        className="zg-social"
      >
        <Mail size={16} strokeWidth={2} />
      </a>
    </div>
  );
}

export default function Footer({ theme }: FooterProps) {
  const { t } = useLanguage();
  const isDark = theme === 'dark';

  return (
    <footer
      className="border-t"
      style={{
        marginTop: 'var(--space-section)',
        background: 'var(--bg-subtle)',
        borderColor: 'var(--border-default)',
      }}
    >
      <div className="container mx-auto px-6 py-14">
        <div className="zg-footer-cols">
          {/* Brand block. The logo used to render at 240px in the middle of the
              row, which put more visual weight on the mark than on anything a
              visitor came to the footer to find. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>
            <Link href="/" aria-label="ZeroGEX home" style={{ display: 'block', lineHeight: 0 }}>
              <Image
                {...brandLogo(isDark)}
                alt="ZeroGEX"
                style={{ height: '68px', width: 'auto', objectFit: 'contain' }}
              />
            </Link>
            <p className="zg-small" style={{ margin: 0, maxWidth: 300 }}>
              {t('footer.tagline')}
            </p>
            <SocialLinks />
            <Link
              href="/giving"
              aria-label={VETERANS_BADGE_TEXT}
              title={VETERANS_BADGE_TEXT}
              className="zg-caption"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 10px 4px 4px',
                borderRadius: 'var(--radius-pill)',
                background: 'color-mix(in srgb, var(--color-brand-primary) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-brand-primary) 30%, transparent)',
                color: 'var(--color-brand-primary)',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <Image
                src="/folds-of-honor-proud-supporter.png"
                alt=""
                width={24}
                height={24}
                style={{ width: 24, height: 24, borderRadius: '50%', background: '#ffffff', padding: 2 }}
              />
              {t('footer.veteransBadge')}
            </Link>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.headingKey} aria-label={t(column.headingKey)}>
              <div className="zg-eyebrow" style={{ marginBottom: 14 }}>
                {t(column.headingKey)}
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
                {column.links.map((link) => (
                  <li key={`${column.headingKey}-${link.href}`}>
                    {link.external ? (
                      <a href={link.href} target="_blank" rel="noreferrer" className="zg-footer-link">
                        {t(link.labelKey)}
                      </a>
                    ) : (
                      <Link href={link.href} className="zg-footer-link">
                        {t(link.labelKey)}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Risk disclosure. Its own full-width band above the legal bar, the
            way regulated finance products present fine print, rather than
            crammed right-aligned into a 360px column. */}
        <p
          className="zg-caption"
          style={{
            margin: 0,
            marginTop: 48,
            paddingTop: 24,
            borderTop: '1px solid var(--border-subtle)',
            maxWidth: '78ch',
          }}
        >
          {t('footer.disclaimer')}
        </p>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginTop: 24,
            paddingTop: 20,
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <p className="zg-caption" style={{ margin: 0 }}>
            {t('footer.rights')}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Link href="/privacy" className="zg-footer-link" style={{ fontSize: 12 }}>
              {t('footer.privacy')}
            </Link>
            <Link href="/terms" className="zg-footer-link" style={{ fontSize: 12 }}>
              {t('footer.terms')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
