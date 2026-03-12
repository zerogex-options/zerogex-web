'use client';

import Link from 'next/link';
import { Theme } from '@/core/types';
import { colors } from '@/core/colors';

interface FooterProps {
  theme: Theme;
}

const border = 'rgba(150,143,146,0.25)';

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
        {/* Top row: logo + nav columns */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 32,
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 36,
          }}
        >
          {/* Brand */}
          <div style={{ maxWidth: 280 }}>
            <img
              src={isDark ? '/logo-dark.svg' : '/logo-light.svg'}
              alt="ZeroGEX"
              style={{ height: '160px', width: 'auto', objectFit: 'contain', marginBottom: 12 }}
            />
            <p style={{ fontSize: 13, color: subtext, lineHeight: 1.65, margin: 0 }}>
              Real-time gamma exposure analytics for options traders who want the institutional edge.
            </p>
          </div>

          {/* Link columns */}
          <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
            {/* Platform */}
            <div>
              <div
                style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.15em',
                  textTransform: 'uppercase', color: colors.primary, marginBottom: 14,
                }}
              >
                Platform
              </div>
              {[
                ['/dashboard', 'Dashboard'],
                ['/gamma-exposure', 'Gamma Exposure'],
                ['/flow-analysis', 'Flow Analysis'],
                ['/trading-signals', 'Trading Signals'],
              ].map(([href, label]) => (
                <div key={href} style={{ marginBottom: 8 }}>
                  <Link
                    href={href}
                    style={{ fontSize: 13, color: subtext, textDecoration: 'none' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = textLight; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = subtext; }}
                  >
                    {label}
                  </Link>
                </div>
              ))}
            </div>

            {/* Tools */}
            <div>
              <div
                style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.15em',
                  textTransform: 'uppercase', color: colors.primary, marginBottom: 14,
                }}
              >
                Tools
              </div>
              {[
                ['/intraday-tools', 'Intraday Tools'],
                ['/max-pain', 'Max Pain'],
                ['/options-calculator', 'Options Calc'],
                ['/about', 'About'],
              ].map(([href, label]) => (
                <div key={href} style={{ marginBottom: 8 }}>
                  <Link
                    href={href}
                    style={{ fontSize: 13, color: subtext, textDecoration: 'none' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = textLight; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = subtext; }}
                  >
                    {label}
                  </Link>
                </div>
              ))}
            </div>

            {/* More */}
            <div>
              <div
                style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.15em',
                  textTransform: 'uppercase', color: colors.primary, marginBottom: 14,
                }}
              >
                More
              </div>
              <div style={{ marginBottom: 8 }}>
                <a
                  href="https://api.zerogex.io/docs"
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 13, color: subtext, textDecoration: 'none' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = textLight; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = subtext; }}
                >
                  API Docs
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom row: copyright + disclaimer */}
        <div
          style={{
            borderTop: `1px solid ${border}`,
            paddingTop: 20,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <p style={{ fontSize: 12, color: subtext, margin: 0 }}>
            © 2026 ZeroGEX, LLC. All rights reserved.
          </p>
          <p style={{ fontSize: 12, color: subtext, margin: 0, maxWidth: 500, textAlign: 'right' }}>
            Trading involves substantial risk. Past performance is not indicative of future results.
            This platform is for informational purposes only, not investment advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
