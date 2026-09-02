'use client';

import { useTheme } from '@/core/ThemeContext';
import FooterBase from './Footer';

// Theme-aware <Footer> wrapper for server-rendered marketing pages. Footer
// itself takes the resolved theme as a prop (it renders a light/dark logo), so
// a server page cannot mount it directly — this reads ThemeContext and passes
// it through.
export default function SiteFooter() {
  const { theme } = useTheme();
  return <FooterBase theme={theme} />;
}
