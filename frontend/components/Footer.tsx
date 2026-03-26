'use client';

import Link from 'next/link';
import { Theme } from '@/core/types';
import { colors } from '@/core/colors';

interface FooterProps {
  theme: Theme;
}

const border = 'rgba(150,143,146,0.25)';

const footerLinks = [
  { href: '/dashboard', label: 'Platform', external: false },
  { href: '/about', label: 'About', external: false },
  { href: 'https://api.zerogex.io/docs', label: 'API Docs', external: true },
  { href: '/education', label: 'Education', external: false },
];

export default function Footer({ theme }: FooterProps) {
  const isDark = theme === 'dark';
  const subtext = isDark ? colors.muted : '#6b636a';
  const textLight = isDark ? colors.light : '#1a1618';

  return (
    <footer
      className="border-t mt-16"
      style={{
        background: isDark
          ? `linear-gradient(135deg, ${colors.cardDark}66 0%, rgba(42,38,40,0.8) 100%)`
          : 'rgba(200,195,200,0.2)',
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
