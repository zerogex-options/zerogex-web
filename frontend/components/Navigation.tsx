'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Theme } from '@/core/types';
import { colors } from '@/core/colors';

interface NavigationProps {
  theme: Theme;
}

export default function Navigation({ theme }: NavigationProps) {
  const pathname = usePathname();
  const router = useRouter();

  const pages = [
    { id: '/', label: 'Dashboard' },
    { id: '/flow-analysis', label: 'Flow Analysis' },
    { id: '/greeks-gex', label: 'Greeks & GEX' },
    { id: '/intraday-tools', label: 'Intraday Tools' },
    { id: '/about', label: 'About' },
  ];

  return (
    <nav
      className="border-b"
      style={{
        backgroundColor: theme === 'dark' ? colors.bgDark : colors.bgLight,
        borderColor: colors.muted,
      }}
    >
      <div className="container mx-auto px-6">
        <div className="flex overflow-x-auto">
          {pages.map((page) => (
            <button
              key={page.id}
              onClick={() => router.push(page.id)}
              className="px-6 py-4 font-semibold text-sm whitespace-nowrap transition-all duration-200 relative"
              style={{
                color: pathname === page.id ? colors.bearish : (theme === 'dark' ? colors.light : colors.dark),
                opacity: pathname === page.id ? 1 : 0.6,
              }}
            >
              {page.label}
              {pathname === page.id && (
                <div 
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{
                    backgroundColor: colors.bearish,
                  }}
                />
              )}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
