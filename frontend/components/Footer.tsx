'use client';

import Link from 'next/link';
import { Mail } from 'lucide-react';
import { Theme } from '@/core/types';
import { colors } from '@/core/colors';

interface FooterProps {
  theme: Theme;
}

const border = 'var(--border-default)';

const footerLinks = [
  { href: '/dashboard', label: 'Platform', external: false },
  { href: '/about', label: 'About', external: false },
  { href: 'https://api.zerogex.io/docs', label: 'API Docs', external: true },
  { href: '/education', label: 'Education', external: false },
  { href: '/privacy', label: 'Privacy', external: false },
  { href: '/terms', label: 'Terms', external: false },
];

const TWITTER_HANDLE = 'zero_gex70930';
const TWITTER_URL = `https://x.com/${TWITTER_HANDLE}`;
const CONTACT_EMAIL = 'zerogexoptions@gmail.com';

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
    backgroundColor: colors.primary,
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
        aria-label={`ZeroGEX on X (@${TWITTER_HANDLE})`}
        title={`@${TWITTER_HANDLE}`}
        style={baseStyle}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <XIcon size={iconSize} />
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
  const isDark = theme === 'dark';
  const subtext = isDark ? colors.muted : 'var(--text-muted)';
  const textLight = isDark ? colors.light : 'var(--text-inverse)';

  return (
    <footer
      className="border-t mt-16"
      style={{
        background: isDark
          ? `linear-gradient(135deg, ${colors.cardDark}66 0%, var(--bg-active) 100%)`
          : 'var(--border-subtle)',
        borderColor: border,
      }}
    >
      <div className="container mx-auto px-6 py-12">
        <div className="hidden md:flex" style={{ alignItems: 'center', gap: 32 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: colors.primary, marginBottom: 14 }}>
              Navigation
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {footerLinks.map((item) => (
                <div key={item.href}>
                  {item.external ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 13, color: subtext, textDecoration: 'none' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = textLight; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = subtext; }}
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      href={item.href}
                      style={{ fontSize: 13, color: subtext, textDecoration: 'none' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = textLight; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = subtext; }}
                    >
                      {item.label}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <img
              src={isDark ? '/logo-dark.svg' : '/logo-light.svg'}
              alt="ZeroGEX"
              style={{ height: '360px', width: 'auto', objectFit: 'contain' }}
            />
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <SocialLinks align="end" />
            <p style={{ fontSize: 12, color: subtext, margin: 0, textAlign: 'right' }}>
              © 2026 ZeroGEX, LLC. All rights reserved.
            </p>
            <p style={{ fontSize: 12, color: subtext, margin: 0, lineHeight: 1.6, textAlign: 'right', maxWidth: 260 }}>
              Trading involves substantial risk. Past performance is not indicative of future results.
              This platform is for informational purposes only, not investment advice.
            </p>
          </div>
        </div>

        <div className="flex md:hidden" style={{ gap: 16 }}>
          <div style={{ flex: '0 0 62%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: colors.primary, marginBottom: 4 }}>
              Navigation
            </div>
            {footerLinks.map((item) => (
              <div key={item.href} style={{ marginBottom: 2 }}>
                {item.external ? (
                  <a href={item.href} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: subtext, textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-block' }}>
                    {item.label}
                  </a>
                ) : (
                  <Link href={item.href} style={{ fontSize: 13, color: subtext, textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-block' }}>
                    {item.label}
                  </Link>
                )}
              </div>
            ))}

            <div style={{ marginTop: 10 }}>
              <SocialLinks size={34} iconSize={16} />
            </div>
            <p style={{ fontSize: 12, color: subtext, margin: '10px 0 0 0', lineHeight: 1.6 }}>
              Trading involves substantial risk. Past performance is not indicative of future results.
              This platform is for informational purposes only, not investment advice.
            </p>
            <p style={{ fontSize: 12, color: subtext, margin: 0 }}>
              © 2026 ZeroGEX, LLC. All rights reserved.
            </p>
          </div>

          <div style={{ flex: '0 0 38%', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <img
              src={isDark ? '/logo-dark.svg' : '/logo-light.svg'}
              alt="ZeroGEX"
              style={{ width: '100%', maxWidth: 160, height: 'auto' }}
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
