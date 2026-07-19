'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Mail, Youtube } from 'lucide-react';
import { Theme } from '@/core/types';
import { colors } from '@/core/colors';
import { useLanguage } from '@/core/LanguageContext';
import type { TranslationKey } from '@/core/i18n';

interface FooterProps {
  theme: Theme;
}

const border = 'var(--border-default)';

const footerLinks: { href: string; label: string; labelKey: TranslationKey; external: boolean }[] = [
  { href: '/dashboard', label: 'Platform', labelKey: 'footer.platform', external: false },
  { href: '/spx-gamma-levels', label: 'Free Gamma Levels', labelKey: 'footer.freeGammaLevels', external: false },
  { href: '/about', label: 'About', labelKey: 'nav.about', external: false },
  { href: '/giving', label: 'Giving Back', labelKey: 'footer.givingBack', external: false },
  { href: 'https://api.zerogex.io/docs', label: 'API Docs', labelKey: 'footer.apiDocs', external: true },
  { href: '/education', label: 'Education', labelKey: 'nav.group.education', external: false },
  { href: '/privacy', label: 'Privacy', labelKey: 'footer.privacy', external: false },
  { href: '/terms', label: 'Terms', labelKey: 'footer.terms', external: false },
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

function SocialLinks({
  size = 38,
  iconSize = 18,
  align = 'start',
}: {
  size?: number;
  iconSize?: number;
  align?: 'start' | 'end';
}) {
  const baseStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--color-brand-primary)',
    color: '#ffffff',
    textDecoration: 'none',
    transition: 'transform 150ms ease, box-shadow 150ms ease, opacity 150ms ease',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
  };

  const onEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.transform = 'translateY(-1px)';
    e.currentTarget.style.boxShadow = '0 6px 14px rgba(0, 0, 0, 0.35)';
    e.currentTarget.style.opacity = '0.92';
  };
  const onLeave = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.25)';
    e.currentTarget.style.opacity = '1';
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        justifyContent: align === 'end' ? 'flex-end' : 'flex-start',
      }}
    >
      <a
        href={TWITTER_URL}
        target="_blank"
        rel="noreferrer"
        aria-label={`ZeroGEX on X (${TWITTER_HANDLE})`}
        title={TWITTER_HANDLE}
        style={baseStyle}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <XIcon size={iconSize} />
      </a>
      <a
        href={YOUTUBE_URL}
        target="_blank"
        rel="noreferrer"
        aria-label={`ZeroGEX on YouTube (${YOUTUBE_HANDLE})`}
        title={YOUTUBE_HANDLE}
        style={baseStyle}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <Youtube size={iconSize} strokeWidth={2.25} />
      </a>
      <a
        href={REDDIT_URL}
        target="_blank"
        rel="noreferrer"
        aria-label={`ZeroGEX on Reddit (${REDDIT_HANDLE})`}
        title={REDDIT_HANDLE}
        style={baseStyle}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <RedditIcon size={iconSize} />
      </a>
      <a
        href={`mailto:${CONTACT_EMAIL}`}
        aria-label={`Email ZeroGEX at ${CONTACT_EMAIL}`}
        title={CONTACT_EMAIL}
        style={baseStyle}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <Mail size={iconSize} strokeWidth={2.25} />
      </a>
    </div>
  );
}

export default function Footer({ theme }: FooterProps) {
  const { t } = useLanguage();
  const isDark = theme === 'dark';
  const subtext = isDark ? 'var(--text-secondary)' : 'var(--text-muted)';
  const textLight = isDark ? "var(--text-primary)" : 'var(--text-inverse)';

  return (
    <footer
      className="border-t mt-16"
      style={{
        background: isDark ? 'var(--bg-active)' : 'var(--border-subtle)',
        borderColor: border,
      }}
    >
      <div className="container mx-auto px-6 py-12">
        <div className="hidden md:flex" style={{ alignItems: 'center', gap: 32 }}>
          <div style={{ flex: 1 }}>
            <div className="zg-label" style={{ color: 'var(--color-brand-primary)', marginBottom: 14 }}>
              {t('footer.navigation')}
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {footerLinks.map((item) => (
                <div key={item.href}>
                  {item.external ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="zg-small"
                      style={{ color: subtext, textDecoration: 'none' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = textLight; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = subtext; }}
                    >
                      {t(item.labelKey)}
                    </a>
                  ) : (
                    <Link
                      href={item.href}
                      className="zg-small"
                      style={{ color: subtext, textDecoration: 'none' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = textLight; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = subtext; }}
                    >
                      {t(item.labelKey)}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Image
              src={isDark ? '/logo-dark.svg' : '/logo-light.svg'}
              alt="ZeroGEX"
              width={360}
              height={360}
              style={{ height: '360px', width: 'auto', objectFit: 'contain' }}
            />
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <SocialLinks align="end" />
            <Link
              href="/giving"
              aria-label={VETERANS_BADGE_TEXT}
              title={VETERANS_BADGE_TEXT}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '4px 10px 4px 4px', borderRadius: 999,
                background: `${'var(--color-brand-primary)'}18`,
                border: `1px solid ${'var(--color-brand-primary)'}40`,
                color: 'var(--color-brand-primary)',
                fontWeight: 700, textDecoration: 'none', marginTop: 4,
              }}
              className="zg-caption"
            >
              <Image
                src="/folds-of-honor-proud-supporter.png"
                alt=""
                width={28}
                height={28}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: '#ffffff',
                  padding: 2,
                }}
              />
              {t('footer.veteransBadge')}
            </Link>
            <p className="zg-caption" style={{ color: subtext, margin: 0, textAlign: 'right' }}>
              {t('footer.rights')}
            </p>
            <p className="zg-caption" style={{ color: subtext, margin: 0, textAlign: 'right', maxWidth: 360 }}>
              {t('footer.disclaimer')}
            </p>
          </div>
        </div>

        <div className="flex md:hidden" style={{ gap: 16 }}>
          <div style={{ flex: '0 0 62%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="zg-label" style={{ color: 'var(--color-brand-primary)', marginBottom: 4 }}>
              {t('footer.navigation')}
            </div>
            {footerLinks.map((item) => (
              <div key={item.href} style={{ marginBottom: 2 }}>
                {item.external ? (
                  <a href={item.href} target="_blank" rel="noreferrer" className="zg-small" style={{ color: subtext, textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-block' }}>
                    {t(item.labelKey)}
                  </a>
                ) : (
                  <Link href={item.href} className="zg-small" style={{ color: subtext, textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-block' }}>
                    {t(item.labelKey)}
                  </Link>
                )}
              </div>
            ))}

            <div style={{ marginTop: 10 }}>
              <SocialLinks size={34} iconSize={16} />
            </div>
            <Link
              href="/giving"
              aria-label={VETERANS_BADGE_TEXT}
              title={VETERANS_BADGE_TEXT}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '4px 10px 4px 4px', borderRadius: 999,
                background: `${'var(--color-brand-primary)'}18`,
                border: `1px solid ${'var(--color-brand-primary)'}40`,
                color: 'var(--color-brand-primary)',
                fontWeight: 700, textDecoration: 'none',
                width: 'fit-content', marginTop: 4,
              }}
              className="zg-caption"
            >
              <Image
                src="/folds-of-honor-proud-supporter.png"
                alt=""
                width={26}
                height={26}
                style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: '#ffffff',
                  padding: 2,
                }}
              />
              {t('footer.veteransBadge')}
            </Link>
            <p className="zg-caption" style={{ color: subtext, margin: '10px 0 0 0' }}>
              {t('footer.disclaimer')}
            </p>
            <p className="zg-caption" style={{ color: subtext, margin: 0 }}>
              {t('footer.rights')}
            </p>
          </div>

          <div style={{ flex: '0 0 38%', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <Image
              src={isDark ? '/logo-dark.svg' : '/logo-light.svg'}
              alt="ZeroGEX"
              width={160}
              height={160}
              style={{ width: '100%', maxWidth: 160, height: 'auto' }}
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
